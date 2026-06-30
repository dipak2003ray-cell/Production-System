from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ScrapBase(BaseModel):
    code: str = Field(..., max_length=50, description="Unique Scrap code identifier")
    name: str = Field(..., max_length=100, description="Friendly scrap category name")
    description: Optional[str] = Field(None, max_length=255)
    is_active: bool = True

class ScrapCreate(ScrapBase):
    pass

class ScrapUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None

class ScrapInDB(ScrapBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
