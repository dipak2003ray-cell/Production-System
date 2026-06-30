from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class CustomerCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=20, description="Unique uppercase business identifier")
    name: str = Field(..., min_length=2, max_length=150, description="Formal corporate business identity")
    contact_person: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    state: Optional[str] = Field(None, description="Company state register. Permits None, evaluated rigidly for intra-state GST locks")

class CustomerResponse(BaseModel):
    id: str
    code: str
    name: str
    contact_person: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    state: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
