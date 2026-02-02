from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    redirect_to: str
    user_id: Optional[int] = None
    institute_id: Optional[str] = None

class TokenData(BaseModel):
    email: str
    role: str
    user_id: int
    institute_id: Optional[str] = None