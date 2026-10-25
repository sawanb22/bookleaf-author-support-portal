from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar_initials: Optional[str] = None
    title: Optional[str] = None
    bank_name: Optional[str] = None
    account_last4: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserOut

class UserMeResponse(BaseModel):
    user: UserOut
