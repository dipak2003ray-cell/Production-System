from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

class EstimateCreateRequest(BaseModel):
    description: Optional[str] = None
    cost_sheet_id: Optional[str] = None
    bom_header_id: Optional[str] = None
    customer_id: Optional[str] = None
    revision_notes: Optional[str] = None

class EstimateUpdateRequest(BaseModel):
    description: Optional[str] = None
    cost_sheet_id: Optional[str] = None
    bom_header_id: Optional[str] = None
    customer_id: Optional[str] = None
    revision_notes: Optional[str] = None

class EstimateResponse(BaseModel):
    id: str
    estimate_number: str
    description: Optional[str]
    status: str
    revision_number: int
    parent_estimate_id: Optional[str]
    previous_revision_id: Optional[str]
    is_current_active: bool
    revision_notes: Optional[str]
    revision_timestamp: Optional[datetime]
    cost_sheet_id: Optional[str]
    bom_header_id: Optional[str]
    customer_id: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowHistoryResponse(BaseModel):
    id: str
    estimate_id: str
    from_status: str
    to_status: str
    changed_by: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class WorkflowStatusResponse(BaseModel):
    estimate_id: str
    estimate_number: str
    current_status: str
    available_next_actions: List[str]
    allowed_transitions: List[str]
    timeline: List[WorkflowHistoryResponse]
