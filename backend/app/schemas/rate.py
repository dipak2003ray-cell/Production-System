from pydantic import BaseModel, Field, model_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime

class RateCardBase(BaseModel):
    material_id: Optional[str] = Field(None, description="Linked Material target reference")
    process_id: Optional[str] = Field(None, description="Linked Process target reference")
    scrap_id: Optional[str] = Field(None, description="Linked Scrap category target reference")

    sub_type: Optional[str] = Field(None, max_length=100, description="Process sub-type qualifier (MS, SS, etc.) or labor class")
    thickness_from: Optional[Decimal] = Field(None, ge=0, description="Minimum thickness thickness range lookup (mm)")
    thickness_to: Optional[Decimal] = Field(None, ge=0, description="Maximum thickness thickness range lookup (mm)")
    
    rate: Decimal = Field(..., ge=0, description="Pricing rate unit value")
    rate_unit: str = Field(..., max_length=50, description="Scale metric (Rs/kg, Rs/m, etc.)")
    
    effective_date: date = Field(..., description="Date from which the pricing rates become legally valid")
    is_active: bool = True
    reason: Optional[str] = Field(None, max_length=255, description="Reason for historical pricing state")

    @model_validator(mode="after")
    def validate_rate_card_constraints(self) -> "RateCardBase":
        targets = [self.material_id, self.process_id, self.scrap_id]
        non_null_count = sum(1 for t in targets if t is not None)
        
        if non_null_count == 0:
            raise ValueError("Exactly one rate target must be defined. Please provide a material_id, process_id, or scrap_id.")
        if non_null_count > 1:
            raise ValueError("Exclusivity violation: rate cards can only align to a single target. Cannot supply multiple ids.")
            
        if self.thickness_from is not None and self.thickness_to is not None:
            if self.thickness_to <= self.thickness_from:
                raise ValueError("Thickness range error: " + (
                    "thickness_to (max thickness) must be strictly greater "
                    "than thickness_from (min thickness)."
                ))
            
        return self

class RateCardCreate(RateCardBase):
    pass

class RateCardUpdate(BaseModel):
    material_id: Optional[str] = None
    process_id: Optional[str] = None
    scrap_id: Optional[str] = None
    sub_type: Optional[Optional[str]] = None
    thickness_from: Optional[Optional[Decimal]] = None
    thickness_to: Optional[Optional[Decimal]] = None
    rate: Optional[Decimal] = Field(None, ge=0)
    rate_unit: Optional[str] = Field(None, max_length=50)
    effective_date: Optional[date] = None
    is_active: Optional[bool] = None
    reason: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_rate_card_update_constraints(self) -> "RateCardUpdate":
        targets = [self.material_id, self.process_id, self.scrap_id]
        non_null_count = sum(1 for t in targets if t is not None)
        if non_null_count > 1:
            raise ValueError("Exclusivity violation: Rate cards can only align to a single target. Cannot supply multiple ids.")
            
        if self.thickness_from is not None and self.thickness_to is not None:
            if self.thickness_to <= self.thickness_from:
                raise ValueError("Thickness range error: " + (
                    "thickness_to (max thickness) must be strictly greater "
                    "than thickness_from (min thickness)."
                ))
        return self

class RateCardInDB(RateCardBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
