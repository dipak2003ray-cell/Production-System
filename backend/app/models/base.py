import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Boolean, text
from sqlalchemy.orm import declarative_base, declared_attr

# Standard Declarative base
Base = declarative_base()

class UUIDPrimaryKeyMixin:
    """Provides a standard dynamic UUID primary key to tables."""
    @declared_attr
    def id(cls):
        return Column(
            String(36), 
            primary_key=True, 
            default=lambda: str(uuid.uuid4()),
            server_default=text("(char(36))")
        )

class AuditMixin:
    """Automates administrative records with timestamps."""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

class SoftDeleteMixin:
    """Enables safety audits and garbage recovery workflows."""
    deleted_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, server_default=text("false"))

    def soft_delete(self):
        self.deleted_at = datetime.utcnow()
        self.is_deleted = True
