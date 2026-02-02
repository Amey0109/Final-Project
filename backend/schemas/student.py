# schemas/student.py
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import date, datetime
import re

class StudentCreate(BaseModel):
    roll_no: str
    full_name: str
    standard: Optional[str] = None  # Class
    stream: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    
    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^[0-9+\-\s()]{10,15}$', v):
            raise ValueError('Invalid phone number format')
        return v
    
    @validator('roll_no')
    def validate_roll_no(cls, v):
        if not v.strip():
            raise ValueError('Roll number cannot be empty')
        return v.strip()

class StudentResponse(BaseModel):
    student_id: int
    roll_no: str
    full_name: str
    standard: Optional[str]
    stream: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    institute_id: str
    status: str
    is_active: bool
    registered_by: Optional[str]
    registration_date: Optional[date]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True