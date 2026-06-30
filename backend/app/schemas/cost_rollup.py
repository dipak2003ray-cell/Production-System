from pydantic import BaseModel, Field
from typing import Optional, List

class OverheadConfig(BaseModel):
    overhead_type: str = Field("PERCENTAGE", description="Overhead type: PERCENTAGE or FIXED")
    overhead_value: float = Field(0.0, description="Overhead rate/value (e.g. 12.0 for 12%, 5000 for ₹5000)")

class FinalCalculateRequest(BaseModel):
    cost_sheet_id: Optional[str] = Field(None, description="Optional target Cost Sheet Header ID to update/finalize")
    bom_header_id: str = Field(..., description="Target BOM Header ID to perform calculations on")
    effective_date: Optional[str] = Field(None, description="Effective lookup date for rates (YYYY-MM-DD), default to today")
    overheads: List[OverheadConfig] = Field(default_factory=list, description="Overhead allocations to apply")
    scrap_type_id: Optional[str] = Field(None, description="Optional Scrap Type Master ID/Code for recovery calculations")
    scrap_quantity: Optional[float] = Field(None, description="Optional Scrap quantity in KG to apply")

class CostBreakdownResponse(BaseModel):
    material_cost_pct: float
    process_cost_pct: float
    scrap_credit_pct: float
    overhead_pct: float
    sub_assembly_pct: float

class TraceabilityNode(BaseModel):
    id: str
    item_type: str  # MATERIAL, PROCESS, SUB_ASSEMBLY, SCRAP_RECOVERY, OVERHEAD
    code: str
    description: str
    quantity: float
    uom: str
    rate: float
    waste_modifier: float = 1.0
    subtotal: float
    explanation: str
    children: List["TraceabilityNode"] = []

class FinalCalculateResponse(BaseModel):
    cost_sheet_id: Optional[str] = None
    cost_sheet_number: Optional[str] = None
    bom_header_id: str
    total_material_cost: float
    total_process_cost: float
    total_scrap_credit: float
    total_overhead_cost: float
    total_sub_assembly_cost: float
    grand_total_cost: float
    breakdown: CostBreakdownResponse
    traceability_tree: List[TraceabilityNode] = []

    model_config = {
        "from_attributes": True
    }
