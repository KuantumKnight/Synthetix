"""
Synthetix Logging Framework
Structured logging (loguru) + immutable JSON audit trail for compliance.
"""
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
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

    # Ensure audit log directory exists
    audit_path = settings.PROJECT_ROOT / settings.AUDIT_LOG_FILE
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info("🚀 Synthetix logging initialized")


def get_logger(name: str):
    """Get a named logger instance."""
    return logger.bind(module=name)


# =============================================================================
# Audit Logging (immutable JSONL append-only log)
# =============================================================================

def log_audit_event(
    action: str,
    defect_id: str = "",
    actor: str = "SYNTHETIX_v1",
    details: dict | None = None,
) -> str:
    """
    Append an immutable audit event to logs/audit.jsonl.
    Returns the unique entry_id.
    """
    entry_id = str(uuid.uuid4())[:12]
    event = {
        "entry_id": entry_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "defect_id": defect_id,
        "actor": actor,
        "details": details or {},
    }

    audit_path = settings.PROJECT_ROOT / settings.AUDIT_LOG_FILE
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    with open(audit_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")

    logger.info(f"📝 Audit: {action} | defect={defect_id} | entry={entry_id}")
    return entry_id


def query_audit_log(
    action: str | None = None,
    defect_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """
    Query the audit log with optional filters.
    Returns list of matching entries.
    """
    audit_path = settings.PROJECT_ROOT / settings.AUDIT_LOG_FILE

    if not audit_path.exists():
        return []

    entries = []
    with open(audit_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)

                # Apply filters
                if action and entry.get("action") != action:
                    continue
                if defect_id and entry.get("defect_id") != defect_id:
                    continue

                entries.append(entry)
            except json.JSONDecodeError:
                continue

    # Sort by timestamp descending (newest first)
    entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)

    return entries[offset:offset + limit]
