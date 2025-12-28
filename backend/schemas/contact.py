from pydantic import BaseModel, EmailStr

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    institution: str
    message: str | None = None
    subscribe: bool = False

class ContactResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    institution: str
    message: str | None

    class Config:
        from_attributes = True
