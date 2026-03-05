"""
Synthetix Report Enhancement Service
AI-powered missing field detection, summary generation, and title improvement.
"""
from backend.services.preprocessor import DefectFieldValidator
from backend.models.defect import DefectReport, ImprovedReport, MissingFieldInfo
from backend.utils.logger import get_logger
from backend.utils.exceptions import EnhancementError

log = get_logger("enhancer")


class ReportEnhancer:
    """Enhance defect reports with missing field detection and AI summaries."""

    def __init__(self):
        self.validator = DefectFieldValidator()
        self._summarizer = None

    def _ensure_summarizer(self):
        """Lazy-load the summarization pipeline."""
        if self._summarizer is None:
            try:
                from transformers import pipeline
                log.info("Loading summarization model...")
                self._summarizer = pipeline(
                    "summarization",
                    model="sshleifer/distilbart-cnn-12-6",
                    device=-1,  # CPU
                )
                log.info("✅ Summarization model loaded")
            except Exception as e:
                log.warning(f"Summarization model unavailable, using extractive fallback: {e}")
                self._summarizer = "fallback"

    def enhance(self, report: DefectReport, top_matches: list = None) -> ImprovedReport:
        """
        Generate an enhanced version of the defect report.

        - Detects missing fields
        - Generates improved title
        - Creates comprehensive summary
        - Scores completeness

        All outputs are grounded in the input data — no hallucination.
        """
        try:
            report_dict = report.model_dump()

            # 1. Missing field detection
            missing_raw = self.validator.find_missing_fields(report_dict)
            missing_fields = [
                MissingFieldInfo(
                    field_name=m["field_name"],
                    suggestion=m["suggestion"],
                )
                for m in missing_raw
            ]

            # 2. Completeness score
            completeness = self.validator.completeness_score(report_dict)

            # 3. Generate improved title
            improved_title = self._generate_improved_title(report)

            # 4. Generate comprehensive summary
            summary = self._generate_summary(report, top_matches)

            return ImprovedReport(
                improved_title=improved_title,
                summary=summary,
                missing_fields=missing_fields,
                completeness_score=completeness,
            )

        except Exception as e:
            log.error(f"Report enhancement failed: {e}")
            raise EnhancementError(
                message="Failed to enhance defect report",
                detail=str(e),
            )

    def _generate_improved_title(self, report: DefectReport) -> str:
        """
        Generate an improved, descriptive title from the report content.
        Grounded in the actual report data only.
        """
        title = report.title.strip()
        description = report.description.strip() if report.description else ""

        # If title is already descriptive (> 15 characters), keep it
        if len(title) > 15:
            # Capitalize first letter and ensure it ends without period
            improved = title[0].upper() + title[1:]
            if improved.endswith("."):
                improved = improved[:-1]
            return improved

        # Build a more descriptive title from available fields
        parts = [title]

        if report.actual:
            actual_short = report.actual.strip()[:80]
            if actual_short and actual_short.lower() not in title.lower():
                parts.append(f"- {actual_short}")

        if report.environment:
            env_short = report.environment.strip()[:40]
            if env_short:
                parts.append(f"[{env_short}]")

        improved = " ".join(parts)
        improved = improved[0].upper() + improved[1:] if improved else title
        return improved

    def _generate_summary(self, report: DefectReport, top_matches: list = None) -> str:
        """
        Generate a comprehensive summary of the defect report.
        All content is extracted from the input — no hallucination.
        """
        self._ensure_summarizer()

        # Build the full text from available fields
        sections = []

        sections.append(f"Title: {report.title}")

        if report.description:
            sections.append(f"Description: {report.description}")

        if report.steps:
            sections.append(f"Steps to Reproduce: {report.steps}")

        if report.expected:
            sections.append(f"Expected Behavior: {report.expected}")

        if report.actual:
            sections.append(f"Actual Behavior: {report.actual}")

        if report.environment:
            sections.append(f"Environment: {report.environment}")

        full_text = ". ".join(sections)

        # Try AI summarization
        if self._summarizer and self._summarizer != "fallback":
            try:
                # Only summarize if text is long enough
                if len(full_text.split()) > 30:
                    result = self._summarizer(
                        full_text,
                        max_length=150,
                        min_length=30,
                        do_sample=False,
                    )
                    if result and result[0].get("summary_text"):
                        summary = result[0]["summary_text"]
                        # Add match context if available
                        if top_matches:
                            match_info = self._format_match_context(top_matches)
                            summary += f" {match_info}"
                        return summary
            except Exception as e:
                log.warning(f"AI summarization failed, using extractive: {e}")

        # Extractive fallback: build summary from key fields
        summary_parts = []
        summary_parts.append(f"Defect '{report.title}'")

        if report.actual:
            summary_parts.append(f"exhibits behavior: {report.actual.strip()[:100]}")

        if report.expected:
            summary_parts.append(f"Expected: {report.expected.strip()[:100]}")

        if report.environment:
            summary_parts.append(f"Observed in: {report.environment.strip()}")

        summary = ". ".join(summary_parts) + "."

        if top_matches:
            match_info = self._format_match_context(top_matches)
            summary += f" {match_info}"

        return summary

    def _format_match_context(self, top_matches: list) -> str:
        """Format top match information for summary context."""
        if not top_matches:
            return ""

        match_count = len(top_matches)
        closest = top_matches[0] if top_matches else None

        if closest:
            closest_title = closest.title if hasattr(closest, "title") else str(closest.get("title", ""))
            closest_score = closest.similarity_score if hasattr(closest, "similarity_score") else closest.get("similarity_score", 0)
            return (
                f"Found {match_count} similar defect(s). "
                f"Closest match: '{closest_title}' (similarity: {closest_score:.1%})."
            )
        return ""
