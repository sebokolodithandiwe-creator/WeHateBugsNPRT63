from sqlalchemy.orm import Session
from app import models


def log_action(
    db: Session,
    user_id: str | None,
    action: str,
    affected_table: str,
    detail: str | None = None,
    ip_address: str | None = None,
):
    """Records an entry in the audit log. Caller is responsible for db.commit()."""
    entry = models.AuditLog(
        user_id=user_id,
        action=action,
        affected_table=affected_table,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(entry)
