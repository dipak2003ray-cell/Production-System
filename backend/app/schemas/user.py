from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Operator authorization password")

class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Secure default password must exceed 7 characters")
    full_name: str = Field(..., min_length=2, max_length=100)
    role_name: str = Field(..., description="Role mapping: L2-Admin, L1-Estimator, PM, Signatory")

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: UserResponse

class TokenRefreshRequest(BaseModel):
    refresh_token: str
