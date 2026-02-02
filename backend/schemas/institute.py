# schemas/institute.py
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class InstituteBase(BaseModel):
    instituteName: str
    address: str
    email: EmailStr
    phone: str
    instituteType: str
    studentCount: int = Field(ge=0)
    contactPerson: str
    subscriptionPlan: str
    paymentMethod: str

class InstituteCreate(InstituteBase):
    instituteId: str
    password: str

class InstituteUpdate(BaseModel):
    instituteName: Optional[str] = None
    address: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    instituteType: Optional[str] = None
    studentCount: Optional[int] = Field(None, ge=0)
    contactPerson: Optional[str] = None
    subscriptionPlan: Optional[str] = None
    paymentMethod: Optional[str] = None

class InstituteResponse(BaseModel):
    institute_id: str
    institute_name: str
    address: str
    email: str
    phone: str
    institute_type: str
    student_count: int
    contact_person: str
    subscription_plan: Optional[str]
    payment_method: Optional[str]
    is_active: Optional[bool] = True  # Make optional with default
    created_at: datetime
    updated_at: Optional[datetime] = None  # Make optional
    
    class Config:
        from_attributes = True