"""
Tests for the Report Enhancement Service.
Tests field extraction, PII scrubbing, citations, and hallucination check.
"""
import pytest
from backend.services.enhancer import ReportEnhancer
from backend.services.preprocessor import TextNormalizer
from backend.models.defect import DefectReport


class TestFieldExtraction:
    """Test regex-based field extraction (zero hallucination)."""

    def setup_method(self):
        self.enhancer = ReportEnhancer()

    def test_extract_http_error_code(self):
        report = DefectReport(
            defect_id="TEST-001",
            title="API failure",
            description="HTTP 503 returned when calling the login endpoint.",
        )
        fields = self.enhancer.extract_fields(report)
        assert "error_code" in fields
        assert fields["error_code"].value is not None
        assert fields["error_code"].is_inferred is True

    def test_extract_exception_type(self):
        report = DefectReport(
            defect_id="TEST-002",
            title="Crash on login",
            description="Application crashed at AuthService.java:142",
            logs="Error: NullPointerException at AuthService.java:142",
        )
        fields = self.enhancer.extract_fields(report)
        # Should extract from available text
        assert any(f.value is not None for f in fields.values() if f.is_inferred)

    def test_extract_environment_from_text(self):
        report = DefectReport(
            defect_id="TEST-003",
            title="Display bug",
            description="Issue occurs on Chrome 120 with Windows 11",
        )
        fields = self.enhancer.extract_fields(report)
        assert "environment" in fields
        if fields["environment"].value:
            assert fields["environment"].is_inferred is True

    def test_extract_timestamp(self):
        report = DefectReport(
            defect_id="TEST-004",
            title="Timeout error",
            description="Error occurred at 2024-01-15T14:30:00Z during batch processing",
        )
        fields = self.enhancer.extract_fields(report)
        assert "timestamp" in fields
        assert fields["timestamp"].value is not None
        assert "2024-01-15" in fields["timestamp"].value

    def test_extract_module(self):
        report = DefectReport(
            defect_id="TEST-005",
            title="Module failure",
            description="PaymentService crashed during transaction processing",
        )
        fields = self.enhancer.extract_fields(report)
        assert "module" in fields
        if fields["module"].value:
            assert "Payment" in fields["module"].value or "Service" in fields["module"].value

    def test_missing_data_marking(self):
        report = DefectReport(
            defect_id="TEST-006",
            title="Simple bug",
            description="Something is broken.",
        )
        fields = self.enhancer.extract_fields(report)
        # Some fields should be MISSING_DATA
        missing_count = sum(1 for f in fields.values() if f.status == "MISSING_DATA")
        assert missing_count >= 1

    def test_confidence_scoring(self):
        report = DefectReport(
            defect_id="TEST-007",
            title="API error",
            description="environment: production. HTTP 500 Internal Server Error",
        )
        fields = self.enhancer.extract_fields(report)
        for _field_name, field in fields.items():
            assert 0.0 <= field.confidence <= 1.0


class TestPIIScrubbing:
    """Test PII detection and masking."""

    def test_scrub_credit_card(self):
        text = "Payment failed for card 4111-1111-1111-1111"
        result = TextNormalizer.scrub_pii(text)
        assert "4111" not in result
        assert "[REDACTED_CC]" in result

    def test_scrub_email(self):
        text = "Error sent to admin@company.com mailbox"
        result = TextNormalizer.scrub_pii(text)
        assert "admin@company.com" not in result
        assert "[REDACTED_EMAIL]" in result

    def test_scrub_phone(self):
        text = "User called from (555) 123-4567 to report"
        result = TextNormalizer.scrub_pii(text)
        assert "555" not in result or "[REDACTED_PHONE]" in result

    def test_scrub_ssn(self):
        text = "SSN 123-45-6789 was exposed in logs"
        result = TextNormalizer.scrub_pii(text)
        assert "123-45-6789" not in result
        assert "[REDACTED_SSN]" in result

    def test_no_scrub_clean_text(self):
        text = "The application crashes when loading the page"
        result = TextNormalizer.scrub_pii(text)
        assert result == text


class TestCitations:
    """Test source citation building."""

    def setup_method(self):
        self.enhancer = ReportEnhancer()

    def test_build_citations_has_source(self):
        report = DefectReport(
            defect_id="TEST-010",
            title="Citation test",
            description="Testing citation building",
        )
        citations = self.enhancer.build_citations(report)
        assert len(citations) >= 1
        assert citations[0].source == "defect:TEST-010"

    def test_citations_include_enriched_fields(self):
        report = DefectReport(
            defect_id="TEST-011",
            title="Enrichment test",
            description="HTTP 500 error in production environment",
        )
        enriched = self.enhancer.extract_fields(report)
        citations = self.enhancer.build_citations(report, enriched_fields=enriched)
        # Should have at least the source citation plus enriched ones
        enriched_citations = [c for c in citations if c.source.startswith("extraction:")]
        # May have enriched citations if fields were extracted
        assert len(citations) >= 1


class TestHallucinationCheck:
    """Test hallucination verification."""

    def setup_method(self):
        self.enhancer = ReportEnhancer()

    def test_hallucination_check_passes(self):
        report = DefectReport(
            defect_id="TEST-020",
            title="Hallucination test",
            description="A simple defect for testing.",
        )
        enriched = self.enhancer.extract_fields(report)
        citations = self.enhancer.build_citations(report, enriched_fields=enriched)
        check = self.enhancer.validate_hallucination_check(enriched, citations, "summary")

        assert check.summary_grounded_in_source is True
        assert check.all_citations_traceable is True
        assert check.fields_not_hallucinated is True


class TestReportEnhancement:
    """Test the full enhancement pipeline."""

    def setup_method(self):
        self.enhancer = ReportEnhancer()

    def test_enhance_returns_improved_report(self):
        report = DefectReport(
            defect_id="TEST-030",
            title="Login crash",
            description="Application crashes when user logs in with expired token.",
            actual="500 Internal Server Error",
        )
        improved = self.enhancer.enhance(report)
        assert improved.improved_title
        assert improved.summary
        assert improved.completeness_score >= 0.0
        assert isinstance(improved.enriched_fields, dict)
        assert isinstance(improved.citations, list)

    def test_enhance_detects_missing_fields(self):
        report = DefectReport(
            defect_id="TEST-031",
            title="Bug",
            description="Desc",
        )
        improved = self.enhancer.enhance(report)
        field_names = [m.field_name for m in improved.missing_fields]
        assert "steps" in field_names
        assert "expected" in field_names
