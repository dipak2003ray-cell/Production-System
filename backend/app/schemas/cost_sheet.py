from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

class CostSheetLineCreate(BaseModel):
    id: Optional[str] = Field(None, description="Unique identifier for parent-child cost mapping")
    bom_line_id: str = Field(..., description="Link to source BOM line")
    parent_cost_line_id: Optional[str] = Field(None, description="Link to parent cost line if nested")
    item_type: str = Field(..., description="Type of the cost item (MATERIAL, PROCESS, etc.)")
    base_rate: float = Field(0.0, description="Base unit rate resolved from rate cards")
    raw_quantity: float = Field(0.0, description="Raw engineering quantity")
    waste_modifier: float = Field(1.0, description="Waste or scrap modifier/multiplier")
    calculated_subtotal: float = Field(0.0, description="Calculated cost subtotal for this item")
    audit_trail_json: Optional[str] = Field(None, description="Computational audit details")

class CostSheetLineResponse(BaseModel):
    id: str
    cost_sheet_header_id: str
    bom_line_id: str
    parent_cost_line_id: Optional[str]
    item_type: str
    base_rate: float
    raw_quantity: float
    waste_modifier: float
    calculated_subtotal: float
    audit_trail_json: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CostSheetHeaderCreate(BaseModel):
    bom_header_id: str = Field(..., description="Target BOM reference")
    revision_number: int = Field(1, description="BOM or Cost Sheet version control number")
    status: str = Field("DRAFT", description="Workflow state (DRAFT, CALCULATED, LOCKED, SUPERSEDED)")
    total_material_cost: float = Field(0.0, description="Sum of material lines")
    total_process_cost: float = Field(0.0, description="Sum of process lines")
    total_scrap_credit: float = Field(0.0, description="Total scrap recovery benefit")
    total_overhead_cost: float = Field(0.0, description="Applicable overhead burden")
    grand_total_cost: float = Field(0.0, description="Sum total of materials, processes, overheads minus scrap")
    lines: Optional[List[CostSheetLineCreate]] = Field(None, description="BOM cost breakdown lines")

class CostSheetHeaderUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Updated workflow state")
    total_material_cost: Optional[float] = None
    total_process_cost: Optional[float] = None
    total_scrap_credit: Optional[float] = None
    total_overhead_cost: Optional[float] = None
    grand_total_cost: Optional[float] = None
    lines: Optional[List[CostSheetLineCreate]] = None

class CostSheetHeaderResponse(BaseModel):
    id: str
    cost_sheet_number: str
    bom_header_id: str
    revision_number: int
    status: str
    total_material_cost: float
    total_process_cost: float
    total_scrap_credit: float
    total_overhead_cost: float
    grand_total_cost: float
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    lines: List[CostSheetLineResponse] = []

    class Config:
        from_attributes = True

class CostCalculationSnapshotResponse(BaseModel):
    id: str
    cost_sheet_header_id: str
    formula_constants_snapshot_json: Optional[str]
    rate_card_snapshot_json: Optional[str]
    computational_log: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
