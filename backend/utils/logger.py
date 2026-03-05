"""
Synthetix Logging Framework
Structured logging with loguru for the entire application.
"""
import sys
from loguru import logger
from backend.config import settings


def setup_logging() -> None:
    """Configure structured logging for the application."""
    # Remove default logger
    logger.remove()

    # Console handler with rich formatting
    logger.add(
        sys.stdout,
        format=settings.LOG_FORMAT,
        level=settings.LOG_LEVEL,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # File handler for persistent logs
    logger.add(
        settings.PROJECT_ROOT / "logs" / "synthetix_{time:YYYY-MM-DD}.log",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    )

    logger.info("🚀 Synthetix logging initialized")


def get_logger(name: str):
    """Get a named logger instance."""
    return logger.bind(module=name)
