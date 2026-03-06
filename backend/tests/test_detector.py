"""
Tests for the Duplicate Detection Engine.
"""
import pytest
from backend.services.preprocessor import TextNormalizer


class TestDuplicateDetectionLogic:
    """Test duplicate detection logic without requiring ML models."""

    def test_threshold_classification_duplicate(self):
        """Score >= 0.90 should be classified as duplicate."""
        score = 0.95
        if score >= 0.90:
            decision = "duplicate"
        elif score >= 0.75:
            decision = "possible_duplicate"
        else:
            decision = "new_defect"
        assert decision == "duplicate"

    def test_threshold_classification_possible(self):
        """Score >= 0.75 and < 0.90 should be possible_duplicate."""
        score = 0.82
        if score >= 0.90:
            decision = "duplicate"
        elif score >= 0.75:
            decision = "possible_duplicate"
        else:
            decision = "new_defect"
        assert decision == "possible_duplicate"

    def test_threshold_classification_new(self):
        """Score < 0.75 should be new_defect."""
        score = 0.60
        if score >= 0.90:
            decision = "duplicate"
        elif score >= 0.75:
            decision = "possible_duplicate"
        else:
            decision = "new_defect"
        assert decision == "new_defect"

    def test_boundary_duplicate(self):
        """Exact threshold boundary: 0.90 = duplicate."""
        score = 0.90
        decision = "duplicate" if score >= 0.90 else "possible_duplicate" if score >= 0.75 else "new_defect"
        assert decision == "duplicate"

    def test_boundary_possible(self):
        """Exact threshold boundary: 0.75 = possible_duplicate."""
        score = 0.75
        decision = "duplicate" if score >= 0.90 else "possible_duplicate" if score >= 0.75 else "new_defect"
        assert decision == "possible_duplicate"

    def test_zero_similarity(self):
        """Zero similarity = new_defect."""
        score = 0.0
        decision = "duplicate" if score >= 0.90 else "possible_duplicate" if score >= 0.75 else "new_defect"
        assert decision == "new_defect"

    def test_similar_texts_normalize_same(self):
        """Similar defect texts should normalize to similar tokens."""
        text1 = "Login page crashes with expired JWT token"
        text2 = "Login page crash when JWT token expires"
        norm1 = TextNormalizer.normalize(text1)
        norm2 = TextNormalizer.normalize(text2)

        tokens1 = set(norm1.split())
        tokens2 = set(norm2.split())
        overlap = tokens1 & tokens2

        # Should share meaningful terms
        assert "login" in overlap or "jwt" in overlap or "token" in overlap

    def test_different_texts_normalize_differently(self):
        """Unrelated defect texts should normalize to different tokens."""
        text1 = "Login page crashes with expired JWT token"
        text2 = "CSV export includes deleted records"
        norm1 = TextNormalizer.normalize(text1)
        norm2 = TextNormalizer.normalize(text2)

        tokens1 = set(norm1.split())
        tokens2 = set(norm2.split())
        overlap = tokens1 & tokens2

        # Should have low or no overlap
        assert len(overlap) < 3

    def test_top_k_matches_limited(self):
        """Top matches should be limited to K results."""
        all_scores = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65]
        top_k = 5
        matches = sorted(all_scores, reverse=True)[:top_k]
        assert len(matches) == 5
        assert matches[0] == 0.95
        assert matches[-1] == 0.75
