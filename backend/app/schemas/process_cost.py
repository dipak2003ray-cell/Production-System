from pydantic import BaseModel, Field
from typing import Optional

class ProcessCalculateRequest(BaseModel):
    bom_line_id: Optional[str] = Field(None, description="Optional BOM line identifier")
    process_id: str = Field(..., description="Target Process Master ID")
    quantity: float = Field(..., description="Driver Quantity (e.g. cuts, strokes, hours, length, area)")
    thickness: Optional[float] = Field(None, description="Input physical thickness in mm")
    sub_type: Optional[str] = Field(None, description="Dynamic specification element e.g. MS, SS, EPOXY")
    effective_date: Optional[str] = Field(None, description="Lookup effective date, default to today")

class ProcessCalculateResponse(BaseModel):
    bom_line_id: Optional[str] = None
    process_id: str
    process_code: str
    rate_card_id: str
    rate: float
    rate_unit: str
    driver_quantity: float
    resolved_driver_type: str
    resolved_subtype: Optional[str] = None
    resolved_thickness: Optional[float] = None
    process_cost: float
    effective_date_used: str
    calculation_formula: str
    audit_trail_json: str

    class Config:
        from_attributes = True
