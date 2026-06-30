from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Index, Text, DateTime
from sqlalchemy.orm import relationship
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class Estimate(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "estimate"

    estimate_number = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, UNDER_REVIEW, CHANGES_REQUESTED, APPROVED, LOCKED, SUPERSEDED
    revision_number = Column(Integer, nullable=False, default=1)
    
    parent_estimate_id = Column(String(36), ForeignKey("estimate.id"), nullable=True)
    previous_revision_id = Column(String(36), ForeignKey("estimate.id"), nullable=True)
    is_current_active = Column(Boolean, nullable=False, default=True)
    revision_notes = Column(Text, nullable=True)
    revision_timestamp = Column(DateTime, nullable=True)

    cost_sheet_id = Column(String(36), ForeignKey("cost_sheet_header.id"), nullable=True)
    bom_header_id = Column(String(36), ForeignKey("bom_header.id"), nullable=True)
    customer_id = Column(String(36), ForeignKey("customer_master.id"), nullable=True)
    created_by = Column(String(100), nullable=True)

    # Relationships
    parent = relationship("Estimate", remote_side="[Estimate.id]", foreign_keys=[parent_estimate_id])
    previous = relationship("Estimate", remote_side="[Estimate.id]", foreign_keys=[previous_revision_id])
    cost_sheet = relationship("CostSheetHeader", foreign_keys=[cost_sheet_id])
    bom_header = relationship("BOMHeader", foreign_keys=[bom_header_id])
    customer = relationship("Customer", foreign_keys=[customer_id])

    __table_args__ = (
        Index("idx_estimate_number", "estimate_number"),
        Index("idx_estimate_status", "status"),
        Index("idx_estimate_parent", "parent_estimate_id"),
    )

class EstimateWorkflowHistory(Base, UUIDPrimaryKeyMixin, AuditMixin):
    __tablename__ = "estimate_workflow_history"

    estimate_id = Column(String(36), ForeignKey("estimate.id"), nullable=False)
    from_status = Column(String(20), nullable=False)
    to_status = Column(String(20), nullable=False)
    changed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    estimate = relationship("Estimate", foreign_keys=[estimate_id])

    __table_args__ = (
        Index("idx_workflow_history_est", "estimate_id"),
    )
