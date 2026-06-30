from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class Role(Base, UUIDPrimaryKeyMixin, AuditMixin):
    __tablename__ = "roles"

    name = Column(String(50), nullable=False, unique=True)
    permissions = Column(String(500), nullable=False) # Semi-colon separated permission lists

    # Relationships
    users = relationship("User", back_populates="role")

class User(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email = Column(String(100), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Security Lockout Parameters
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)

    # Relationships
    role = relationship("Role", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

# Performance indexes
Index("idx_users_email", User.email, unique=True)
Index("idx_users_role_id", User.role_id)
