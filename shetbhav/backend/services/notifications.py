"""
Notification service — creates in-app notifications for the counterparty
on every transaction state change (offer sent/accepted/rejected/countered,
order status updates, grievance resolution).
"""
from typing import Optional
from sqlalchemy.orm import Session
from models.database import Notification


def notify(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str,
    link: Optional[str] = None,
) -> None:
    """Queue a notification row. Caller is responsible for db.commit()."""
    if not user_id:
        return
    db.add(Notification(
        user_id=user_id, title=title, message=message, type=type, link=link,
    ))
