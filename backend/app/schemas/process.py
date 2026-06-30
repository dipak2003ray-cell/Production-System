from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProcessBase(BaseModel):
    name: str = Field(..., max_length=100, description="Process name, eg Laser Cutting")
    description: Optional[str] = Field(None, max_length=255, description="Brief narrative breakdown")
    is_active: bool = True
    driver_type: Optional[str] = Field(None, max_length=50, description="Process driver categorization model")

class ProcessCreate(ProcessBase):
    pass

class ProcessUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    driver_type: Optional[str] = Field(None, max_length=50)

class ProcessInDB(ProcessBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
