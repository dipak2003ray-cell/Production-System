from pydantic import BaseModel, Field
from typing import Optional

class ScrapCalculateRequest(BaseModel):
    bom_line_id: Optional[str] = Field(None, description="Optional BOM line identifier")
    material_id: Optional[str] = Field(None, description="Optional parent Material Master ID")
    material_quantity: Optional[float] = Field(None, description="Input Material Quantity")
    effective_consumption: Optional[float] = Field(None, description="Effective Consumption")
    scrap_quantity: float = Field(..., ge=0.0, description="Quantity of scrap generated")
    scrap_type: str = Field(..., description="Scrap Type Master ID or Code")
    effective_date: Optional[str] = Field(None, description="Effective lookup date, default to today")

class ScrapCalculateResponse(BaseModel):
    bom_line_id: Optional[str] = None
    material_id: Optional[str] = None
    scrap_type_id: str
    scrap_type_code: str
    scrap_type_name: str
    rate_card_id: str
    rate: float
    rate_unit: str
    scrap_quantity: float
    recovery_credit: float
    effective_date_used: str
    formula_used: str
    calculation_explanation: str
    audit_trail_json: str

    model_config = {
        "from_attributes": True
    }
