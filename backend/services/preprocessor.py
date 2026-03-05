"""
Synthetix Text Preprocessor
Text normalization & field extraction for defect reports.
"""
import re
import string
from backend.utils.logger import get_logger

log = get_logger("preprocessor")

# Common stop words (lightweight, no external dependency needed at runtime)
STOP_WORDS = {
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "for", "of", "and",
    "or", "but", "not", "with", "this", "that", "was", "are", "be", "has",
    "had", "have", "been", "will", "would", "could", "should", "may", "can",
    "do", "does", "did", "i", "you", "he", "she", "we", "they", "my", "your",
    "his", "her", "our", "their", "me", "him", "us", "them", "its", "am",
}


class TextNormalizer:
    """Normalize and clean text for embedding generation."""

    @staticmethod
    def normalize(text: str | None) -> str:
        """
        Full normalization pipeline:
        1. Lowercase
        2. Remove URLs
        3. Remove special characters (keep alphanumeric + spaces)
        4. Remove extra whitespace
        5. Remove stop words
        """
        if not text or not text.strip():
            return ""

        text = text.lower().strip()

        # Remove URLs
        text = re.sub(r"https?://\S+|www\.\S+", " ", text)

        # Remove file paths
        text = re.sub(r"[A-Za-z]:\\[\w\\]+|/[\w/]+\.\w+", " ", text)

        # Remove stack trace line numbers
        text = re.sub(r"at\s+[\w.]+:\d+", " ", text)

        # Remove hex addresses
        text = re.sub(r"0x[0-9a-fA-F]+", " ", text)

        # Keep alphanumeric, spaces, hyphens, and underscores
        text = re.sub(r"[^a-z0-9\s\-_]", " ", text)

        # Collapse multiple spaces
        text = re.sub(r"\s+", " ", text).strip()

        # Remove stop words
        tokens = text.split()
        tokens = [t for t in tokens if t not in STOP_WORDS and len(t) > 1]

        return " ".join(tokens)

    @staticmethod
    def combine_fields(
        title: str,
        description: str,
        steps: str | None = None,
        expected: str | None = None,
        actual: str | None = None,
    ) -> str:
        """
        Combine multiple defect fields into a single text for embedding.
        Weighted: title is repeated for emphasis.
        """
        parts = []

        # Title gets triple weight (repeated for embedding emphasis)
        if title:
            parts.extend([title] * 3)

        if description:
            parts.append(description)

        if steps:
            parts.append(f"steps: {steps}")

        if expected:
            parts.append(f"expected: {expected}")

        if actual:
            parts.append(f"actual: {actual}")

        combined = " ".join(parts)
        return TextNormalizer.normalize(combined)


class DefectFieldValidator:
    """Validate and check defect report fields."""

    REQUIRED_FIELDS = ["title", "description"]
    RECOMMENDED_FIELDS = ["steps", "expected", "actual", "environment"]
    OPTIONAL_FIELDS = ["logs"]

    FIELD_SUGGESTIONS = {
        "steps": "Add step-by-step reproduction instructions (e.g., '1. Open the app, 2. Click login...')",
        "expected": "Describe what the correct behavior should be",
        "actual": "Describe what actually happened instead",
        "environment": "Specify OS, browser, app version, etc. (e.g., 'Chrome 120, Windows 11')",
        "logs": "Include relevant error logs, stack traces, or console output",
    }

    @classmethod
    def find_missing_fields(cls, report: dict) -> list[dict]:
        """
        Identify missing or empty fields in a defect report.
        Returns list of {field_name, suggestion} dicts.
        """
        missing = []

        for field in cls.RECOMMENDED_FIELDS + cls.OPTIONAL_FIELDS:
            value = report.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                missing.append({
                    "field_name": field,
                    "suggestion": cls.FIELD_SUGGESTIONS.get(
                        field, f"Please provide the '{field}' field"
                    ),
                })

        return missing

    @classmethod
    def completeness_score(cls, report: dict) -> float:
        """
        Calculate report completeness as a percentage.
        Required fields = 40%, Recommended = 50%, Optional = 10%.
        """
        total_score = 0.0
        max_score = 100.0

        # Required fields (40% weight)
        req_weight = 40.0 / len(cls.REQUIRED_FIELDS) if cls.REQUIRED_FIELDS else 0
        for field in cls.REQUIRED_FIELDS:
            value = report.get(field)
            if value and isinstance(value, str) and value.strip():
                total_score += req_weight

        # Recommended fields (50% weight)
        rec_weight = 50.0 / len(cls.RECOMMENDED_FIELDS) if cls.RECOMMENDED_FIELDS else 0
        for field in cls.RECOMMENDED_FIELDS:
            value = report.get(field)
            if value and isinstance(value, str) and value.strip():
                total_score += rec_weight

        # Optional fields (10% weight)
        opt_weight = 10.0 / len(cls.OPTIONAL_FIELDS) if cls.OPTIONAL_FIELDS else 0
        for field in cls.OPTIONAL_FIELDS:
            value = report.get(field)
            if value and isinstance(value, str) and value.strip():
                total_score += opt_weight

        return min(round(total_score, 1), max_score)
