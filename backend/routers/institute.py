# institute.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from passlib.context import CryptContext
from utils.hashing import hash_password
from database import get_db
from models.institute import Institute
from models.users import User
from schemas.institute import InstituteCreate, InstituteUpdate, InstituteResponse

router = APIRouter(prefix="/institutes", tags=["Institute"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# GET all institutes
@router.get("/", response_model=List[InstituteResponse])
def get_institutes(db: Session = Depends(get_db)):
    """Get all institutes"""
    institutes = db.query(Institute).all()
    return institutes

# GET single institute by ID
@router.get("/{institute_id}", response_model=InstituteResponse)
def get_institute(institute_id: str, db: Session = Depends(get_db)):
    """Get institute by ID"""
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institute not found"
        )
    
    return institute

# POST - Register new institute (existing code)
@router.post("/register")
def register_institute(data: InstituteCreate, db: Session = Depends(get_db)):
    # 1️⃣ Check institute exists
    existing = db.query(Institute).filter(
        Institute.institute_id == data.instituteId
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Institute already registered")

    # 2️⃣ Create Institute
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

    # 3️⃣ Create Admin User for Institute
    admin_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="ADMIN",
        institute_id=institute.institute_id,
        is_active=True
    )

    db.add(admin_user)
    db.commit()

    return {
        "message": "Institute registered successfully",
        "admin_email": admin_user.email,
        "institute_id": institute.institute_id
    }

# PUT - Update institute
@router.put("/{institute_id}")
def update_institute(
    institute_id: str, 
    data: InstituteUpdate, 
    db: Session = Depends(get_db)
):
    """Update institute information"""
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institute not found"
        )
    
    # Update fields if provided
    if data.instituteName is not None:
        institute.institute_name = data.instituteName
    if data.address is not None:
        institute.address = data.address
    if data.email is not None:
        # Check if email is already used by another institute
        existing_email = db.query(Institute).filter(
            Institute.email == data.email,
            Institute.institute_id != institute_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        institute.email = data.email
    if data.phone is not None:
        institute.phone = data.phone
    if data.instituteType is not None:
        institute.institute_type = data.instituteType
    if data.studentCount is not None:
        institute.student_count = data.studentCount
    if data.contactPerson is not None:
        institute.contact_person = data.contactPerson
    if data.subscriptionPlan is not None:
        institute.subscription_plan = data.subscriptionPlan
    if data.paymentMethod is not None:
        institute.payment_method = data.paymentMethod
    
    institute.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(institute)
    
    return {
        "message": "Institute updated successfully",
        "institute_id": institute.institute_id
    }

# DELETE - Deactivate institute
@router.delete("/{institute_id}")
def deactivate_institute(institute_id: str, db: Session = Depends(get_db)):
    """Deactivate an institute (soft delete)"""
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institute not found"
        )
    
    # Soft delete by setting is_active to False
    institute.is_active = False
    institute.updated_at = datetime.utcnow()
    db.commit()
    
    # Also deactivate all users associated with this institute
    users = db.query(User).filter(
        User.institute_id == institute_id
    ).all()
    
    for user in users:
        user.is_active = False
        user.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Institute deactivated successfully",
        "institute_id": institute_id
    }

# PATCH - Activate institute
@router.patch("/{institute_id}/activate")
def activate_institute(institute_id: str, db: Session = Depends(get_db)):
    """Activate a deactivated institute"""
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institute not found"
        )
    
    institute.is_active = True
    institute.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "Institute activated successfully",
        "institute_id": institute_id
    }

# GET institute users
@router.get("/{institute_id}/users")
def get_institute_users(institute_id: str, db: Session = Depends(get_db)):
    """Get all users of an institute"""
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institute not found"
        )
    
    users = db.query(User).filter(
        User.institute_id == institute_id
    ).all()
    
    return {
        "institute_id": institute_id,
        "institute_name": institute.institute_name,
        "users": [
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at,
            }
            for user in users
        ]
    }