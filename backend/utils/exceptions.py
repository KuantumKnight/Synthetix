"""
Synthetix Custom Exceptions
Graceful error handling for the entire application.
"""
from fastapi import HTTPException, status


class SynthetixException(Exception):
    """Base exception for Synthetix."""

    def __init__(self, message: str, detail: str | None = None):
        self.message = message
        self.detail = detail
        super().__init__(self.message)


class DataIngestionError(SynthetixException):
    """Raised when data ingestion fails."""
    pass


class EmbeddingError(SynthetixException):
    """Raised when embedding generation fails."""
    pass


class VectorStoreError(SynthetixException):
    """Raised when vector store operations fail."""
    pass


class DetectionError(SynthetixException):
    """Raised when duplicate detection fails."""
    pass


class ClusteringError(SynthetixException):
    """Raised when clustering operations fail."""
    pass


class EnhancementError(SynthetixException):
    """Raised when report enhancement fails."""
    pass


class InvalidInputError(SynthetixException):
    """Raised when input validation fails."""
    pass


def handle_synthetix_error(error: SynthetixException) -> HTTPException:
    """Convert a Synthetix exception to an HTTP exception."""
    error_map = {
        InvalidInputError: status.HTTP_400_BAD_REQUEST,
        DataIngestionError: status.HTTP_422_UNPROCESSABLE_ENTITY,
        EmbeddingError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        VectorStoreError: status.HTTP_503_SERVICE_UNAVAILABLE,
        DetectionError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        ClusteringError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        EnhancementError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    }

    status_code = error_map.get(type(error), status.HTTP_500_INTERNAL_SERVER_ERROR)
    return HTTPException(
        status_code=status_code,
        detail={
            "error": type(error).__name__,
            "message": error.message,
            "detail": error.detail,
        },
    )
