from pydantic import BaseModel, EmailStr

class InstituteCreate(BaseModel):
    instituteId: str
    instituteName: str
    address: str
    email: EmailStr
    phone: str
    instituteType: str
    studentCount: int
    contactPerson: str
    subscriptionPlan: str
    paymentMethod: str
