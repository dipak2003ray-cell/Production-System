from sqlalchemy import Column, String, Boolean, Index
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class ProcessMaster(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "process_master"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    driver_type = Column(String(50), nullable=True) # e.g. "thickness", "run_time", "passes"

# Uniqueness and lookup index
Index("idx_process_master_name", ProcessMaster.name, unique=True)
