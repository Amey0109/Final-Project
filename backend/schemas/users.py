# models/users.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"
    FACULTY = "FACULTY"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = UserRole.STUDENT
    institute_id: Optional[str]= None
    is_active: Optional[bool] = True


class UserProfileResponse(BaseModel):
    success: bool
    data: dict

class EmailUpdate(BaseModel):
    email: EmailStr

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    
   
    