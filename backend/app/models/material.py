from sqlalchemy import Column, String, Numeric, Index
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class MaterialMaster(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "material_master"

    code = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=False)
    grade_spec = Column(String(100), nullable=True)
    profile_size = Column(String(100), nullable=True)
    std_unit = Column(String(20), nullable=False) # kg, meter, sq-meter, etc.
    last_rate = Column(Numeric(10, 4), nullable=False, default=0.0)

# Performance and uniqueness index
Index("idx_material_master_code", MaterialMaster.code, unique=True)
