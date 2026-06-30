from sqlalchemy import Column, String, Numeric, Date, Boolean, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class RateCard(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "rate_card"

    material_id = Column(String(36), ForeignKey("material_master.id"), nullable=True)
    process_id = Column(String(36), ForeignKey("process_master.id"), nullable=True)
    scrap_id = Column(String(36), ForeignKey("scrap_type_master.id"), nullable=True)

    sub_type = Column(String(100), nullable=True) # e.g. MS, SS, AL, Helper, Skilled
    thickness_from = Column(Numeric(10, 4), nullable=True) # in mm
    thickness_to = Column(Numeric(10, 4), nullable=True)   # in mm
    
    rate = Column(Numeric(10, 4), nullable=False) # rate value
    rate_unit = Column(String(50), nullable=False) # e.g. Rs/kg, Rs/m, Rs/hour
    
    effective_date = Column(Date, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    reason = Column(String(255), nullable=True) # reason for lookup/revision

    # Relationships
    material = relationship("MaterialMaster", foreign_keys=[material_id])
    process = relationship("ProcessMaster", foreign_keys=[process_id])
    scrap = relationship("ScrapTypeMaster", foreign_keys=[scrap_id])

    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN material_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN process_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN scrap_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_rate_card_target_exclusivity"
        ),
        CheckConstraint("rate >= 0", name="ck_rate_card_non_negative_rate"),
        CheckConstraint(
            "thickness_from IS NULL OR thickness_to IS NULL OR thickness_to > thickness_from",
            name="ck_rate_card_thickness_range"
        ),
        Index("idx_rate_card_material", "material_id"),
        Index("idx_rate_card_process", "process_id"),
        Index("idx_rate_card_scrap", "scrap_id"),
        Index("idx_rate_card_lookup", "effective_date", "is_active"),
    )
