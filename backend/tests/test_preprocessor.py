"""
Tests for the Text Preprocessor.
"""
import pytest
from backend.services.preprocessor import TextNormalizer, DefectFieldValidator


class TestTextNormalizer:
    """Test text normalization pipeline."""

    def test_normalize_basic(self):
        text = "The application CRASHES when loading the page!"
        result = TextNormalizer.normalize(text)
        assert "crashes" in result
        assert "loading" in result
        assert "page" in result
        # Stop words removed
        assert " the " not in f" {result} "

    def test_normalize_empty(self):
        assert TextNormalizer.normalize("") == ""
        assert TextNormalizer.normalize(None) == ""
        assert TextNormalizer.normalize("   ") == ""

    def test_normalize_removes_urls(self):
        text = "Error at https://example.com/api/login endpoint"
        result = TextNormalizer.normalize(text)
        assert "https" not in result
        assert "example.com" not in result
        assert "error" in result

    def test_normalize_removes_hex(self):
        text = "Memory leak at 0x7fff5fbff8c0 address"
        result = TextNormalizer.normalize(text)
        assert "0x7fff" not in result

    def test_combine_fields_weights_title(self):
        result = TextNormalizer.combine_fields(
            title="Login crash",
            description="The application crashes on login",
        )
        # Title should appear multiple times for weighting
        count = result.count("login")
        assert count >= 2, "Title should be repeated for emphasis"

    def test_combine_fields_includes_steps(self):
        result = TextNormalizer.combine_fields(
            title="Test",
            description="Description",
            steps="1. Click button 2. Submit form",
        )
        assert "click" in result
        assert "button" in result


class TestDefectFieldValidator:
    """Test field validation and completeness scoring."""

    def test_find_missing_fields_complete(self):
        report = {
            "title": "Bug title",
            "description": "Description",
            "steps": "Steps here",
            "expected": "Expected behavior",
            "actual": "Actual behavior",
            "environment": "Chrome 120",
            "logs": "Error log",
        }
        missing = DefectFieldValidator.find_missing_fields(report)
        assert len(missing) == 0

    def test_find_missing_fields_partial(self):
        report = {
            "title": "Bug title",
            "description": "Description",
            "steps": "",
            "expected": None,
        }
        missing = DefectFieldValidator.find_missing_fields(report)
        field_names = [m["field_name"] for m in missing]
        assert "steps" in field_names
        assert "expected" in field_names
        assert "actual" in field_names
        assert "environment" in field_names

    def test_completeness_full(self):
        report = {
            "title": "Bug",
            "description": "Desc",
            "steps": "Steps",
            "expected": "Expected",
            "actual": "Actual",
            "environment": "Env",
            "logs": "Logs",
        }
        score = DefectFieldValidator.completeness_score(report)
        assert score == 100.0

    def test_completeness_partial(self):
        report = {
            "title": "Bug",
            "description": "Desc",
        }
        score = DefectFieldValidator.completeness_score(report)
        assert 30 <= score <= 50  # Only required fields filled

    def test_completeness_empty(self):
        report = {}
        score = DefectFieldValidator.completeness_score(report)
        assert score == 0.0

    def test_missing_field_suggestions(self):
        report = {"title": "Bug", "description": "Desc"}
        missing = DefectFieldValidator.find_missing_fields(report)
        for m in missing:
            assert "suggestion" in m
            assert len(m["suggestion"]) > 10
