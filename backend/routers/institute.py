from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Institute
from schemas import InstituteCreate

router = APIRouter(prefix="/register-institute", tags=["Institute"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
def register_institute(data: InstituteCreate, db: Session = Depends(get_db)):
    existing = db.query(Institute).filter(
        Institute.institute_id == data.instituteId
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Institute already registered")

    institute = Institute(
        institute_id=data.instituteId,
        institute_name=data.instituteName,
        address=data.address,
        email=data.email,
        phone=data.phone,
        institute_type=data.instituteType,
        student_count=data.studentCount,
        contact_person=data.contactPerson,
        subscription_plan=data.subscriptionPlan,
        payment_method=data.paymentMethod
    )

    db.add(institute)
    db.commit()
    db.refresh(institute)

    return {
        "message": "Institute registered successfully",
        "institute_id": institute.institute_id
    }
