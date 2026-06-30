from sqlalchemy import Column, String, Boolean, Index
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class ScrapTypeMaster(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "scrap_type_master"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

# Uniqueness and lookup index
Index("idx_scrap_type_master_code", ScrapTypeMaster.code, unique=True)
