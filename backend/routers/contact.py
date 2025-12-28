from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models.contact import ContactMessage
from schemas.contact import ContactCreate

router = APIRouter(
    prefix="/contact",
    tags=["Contact"]
)

@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_contact_message(
    data: ContactCreate,
    db: Session = Depends(get_db)
):
    new_message = ContactMessage(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        institution=data.institution,
        message=data.message,
        subscribe="true" if data.subscribe else "false"
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return {
        "message": "Thank you for contacting us. We will get back to you soon."
    }
