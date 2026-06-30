from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class BOMHeader(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "bom_header"

    part_number = Column(String(100), nullable=False)
    revision_number = Column(Integer, nullable=False, default=1)
    customer_id = Column(String(36), ForeignKey("customer_master.id"), nullable=True)
    description = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT") # DRAFT, RELEASED, SUPERSEDED
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(100), nullable=True)

    # Relationships
    customer = relationship("Customer", foreign_keys=[customer_id])
    lines = relationship("BOMLine", back_populates="bom_header", cascade="all, delete-orphan", foreign_keys="[BOMLine.bom_header_id]")

    __table_args__ = (
        Index("idx_bom_header_part_rev", "part_number", "revision_number", unique=True),
        Index("idx_bom_header_status", "status"),
    )

class BOMLine(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "bom_line"

    bom_header_id = Column(String(36), ForeignKey("bom_header.id"), nullable=False)
    parent_bom_line_id = Column(String(36), ForeignKey("bom_line.id"), nullable=True)
    line_type = Column(String(20), nullable=False) # MATERIAL, PROCESS, SUB_ASSEMBLY, NOTE
    sequence_number = Column(Integer, nullable=False)
    
    material_id = Column(String(36), ForeignKey("material_master.id"), nullable=True)
    process_id = Column(String(36), ForeignKey("process_master.id"), nullable=True)
    sub_assembly_bom_id = Column(String(36), ForeignKey("bom_header.id"), nullable=True)
    
    description = Column(String(255), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=False, default=1.0)
    uom = Column(String(20), nullable=False)
    remarks = Column(String(255), nullable=True)

    # Relationships
    bom_header = relationship("BOMHeader", back_populates="lines", foreign_keys=[bom_header_id])
    parent = relationship("BOMLine", remote_side="[BOMLine.id]", foreign_keys=[parent_bom_line_id])
    children = relationship("BOMLine", back_populates="parent", foreign_keys=[parent_bom_line_id])
    material = relationship("MaterialMaster", foreign_keys=[material_id])
    process = relationship("ProcessMaster", foreign_keys=[process_id])
    sub_assembly = relationship("BOMHeader", foreign_keys=[sub_assembly_bom_id])

    __table_args__ = (
        Index("idx_bom_line_header", "bom_header_id"),
        Index("idx_bom_line_parent", "parent_bom_line_id"),
    )
