from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class CostSheetHeader(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "cost_sheet_header"

    cost_sheet_number = Column(String(50), nullable=False, unique=True)
    bom_header_id = Column(String(36), ForeignKey("bom_header.id"), nullable=False)
    revision_number = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="DRAFT") # DRAFT, CALCULATED, LOCKED, SUPERSEDED
    
    total_material_cost = Column(Numeric(12, 4), nullable=False, default=0.0)
    total_process_cost = Column(Numeric(12, 4), nullable=False, default=0.0)
    total_scrap_credit = Column(Numeric(12, 4), nullable=False, default=0.0)
    total_overhead_cost = Column(Numeric(12, 4), nullable=False, default=0.0)
    grand_total_cost = Column(Numeric(12, 4), nullable=False, default=0.0)
    
    created_by = Column(String(100), nullable=True)

    # Relationships
    bom_header = relationship("BOMHeader", foreign_keys=[bom_header_id])
    lines = relationship("CostSheetLine", back_populates="cost_sheet", cascade="all, delete-orphan", foreign_keys="[CostSheetLine.cost_sheet_header_id]")
    snapshots = relationship("CostCalculationSnapshot", back_populates="cost_sheet", cascade="all, delete-orphan", foreign_keys="[CostCalculationSnapshot.cost_sheet_header_id]")

    __table_args__ = (
        Index("idx_cost_sheet_number", "cost_sheet_number"),
        Index("idx_cost_sheet_bom", "bom_header_id"),
        Index("idx_cost_sheet_status", "status"),
    )

class CostSheetLine(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "cost_sheet_line"

    cost_sheet_header_id = Column(String(36), ForeignKey("cost_sheet_header.id"), nullable=False)
    bom_line_id = Column(String(36), ForeignKey("bom_line.id"), nullable=False)
    parent_cost_line_id = Column(String(36), ForeignKey("cost_sheet_line.id"), nullable=True)
    item_type = Column(String(50), nullable=False) # e.g. MATERIAL, PROCESS, SUB_ASSEMBLY, NOTE
    
    base_rate = Column(Numeric(12, 4), nullable=False, default=0.0)
    raw_quantity = Column(Numeric(12, 4), nullable=False, default=0.0)
    waste_modifier = Column(Numeric(12, 4), nullable=False, default=1.0)
    calculated_subtotal = Column(Numeric(12, 4), nullable=False, default=0.0)
    audit_trail_json = Column(Text, nullable=True)

    # Relationships
    cost_sheet = relationship("CostSheetHeader", back_populates="lines", foreign_keys=[cost_sheet_header_id])
    bom_line = relationship("BOMLine", foreign_keys=[bom_line_id])
    parent = relationship("CostSheetLine", remote_side="[CostSheetLine.id]", foreign_keys=[parent_cost_line_id])
    children = relationship("CostSheetLine", back_populates="parent", foreign_keys=[parent_cost_line_id])

    __table_args__ = (
        Index("idx_cost_line_sheet", "cost_sheet_header_id"),
        Index("idx_cost_line_bom", "bom_line_id"),
    )

class CostCalculationSnapshot(Base, UUIDPrimaryKeyMixin, AuditMixin):
    __tablename__ = "cost_calculation_snapshot"

    cost_sheet_header_id = Column(String(36), ForeignKey("cost_sheet_header.id"), nullable=False)
    formula_constants_snapshot_json = Column(Text, nullable=True)
    rate_card_snapshot_json = Column(Text, nullable=True)
    computational_log = Column(Text, nullable=True)

    # Relationships
    cost_sheet = relationship("CostSheetHeader", back_populates="snapshots", foreign_keys=[cost_sheet_header_id])

    __table_args__ = (
        Index("idx_snapshot_sheet", "cost_sheet_header_id"),
    )
