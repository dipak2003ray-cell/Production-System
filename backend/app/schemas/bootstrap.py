from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from .user import UserResponse

class BootstrapSubmitRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Secure master admin password must contain at least 8 characters")
    full_name: str = Field(..., min_length=3, max_length=100)

class BootstrapStatusResponse(BaseModel):
    bootstrapped: bool
    config: Optional[dict] = None
