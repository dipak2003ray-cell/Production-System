from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin

class UserSession(Base, UUIDPrimaryKeyMixin, AuditMixin):
    __tablename__ = "sessions"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    refresh_token = Column(String(255), nullable=False, unique=True)
    ip_address = Column(String(45), nullable=True) # IPv4 or IPv6 support
    user_agent = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="sessions")

# Performance indexes
Index("idx_sessions_token", UserSession.refresh_token, unique=True)
Index("idx_sessions_user_id", UserSession.user_id)
