from pydantic import BaseModel, Field
from typing import Optional

class MaterialCalculateRequest(BaseModel):
    bom_line_id: Optional[str] = Field(None, description="Optional BOM line identifier")
    material_id: str = Field(..., description="Target Material Master ID")
    quantity: float = Field(..., description="BOM Line Raw Quantity")
    uom: str = Field(..., description="BOM Line Unit of Measure")
    waste_modifier: float = Field(1.0, description="Waste multiplier (e.g. 1.05 for 5% waste)")
    effective_date: Optional[str] = Field(None, description="Lookup effective date, default to today")

class MaterialCalculateResponse(BaseModel):
    bom_line_id: Optional[str] = None
    material_id: str
    material_code: str
    rate_card_id: str
    rate: float
    rate_unit: str
    original_quantity: float
    original_uom: str
    resolved_quantity: float
    resolved_uom: str
    waste_modifier: float
    waste_quantity: float
    effective_quantity: float
    material_subtotal: float
    effective_date_used: str
    conversion_applied: Optional[str] = None
    waste_factor_applied: float
    calculation_explanation: str
    audit_trail_json: str

    class Config:
        from_attributes = True
