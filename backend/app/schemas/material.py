from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime

class MaterialBase(BaseModel):
    code: str = Field(..., max_length=50, description="Unique material designation code")
    description: str = Field(..., max_length=255, description="Factual description profile")
    grade_spec: Optional[str] = Field(None, max_length=100)
    profile_size: Optional[str] = Field(None, max_length=100)
    std_unit: str = Field(..., max_length=20, description="Standard pricing unit, eg kg, meter")
    last_rate: Decimal = Field(default=Decimal("0.0"), ge=0, description="Last recorded unit rate")

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    grade_spec: Optional[str] = Field(None, max_length=100)
    profile_size: Optional[str] = Field(None, max_length=100)
    std_unit: Optional[str] = Field(None, max_length=20)
    last_rate: Optional[Decimal] = Field(None, ge=0)

class MaterialInDB(MaterialBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
