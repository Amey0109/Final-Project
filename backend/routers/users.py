from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
import re
from typing import Dict, Any
from passlib.context import CryptContext

from database import get_db
from models.users import User
from models.institute import Institute
from models.student import Student
from schemas.users import UserCreate, UserProfileResponse, EmailUpdate, PasswordChange
from routers.auth import get_current_user
from utils.hashing import hash_password, verify_password

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/register", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user with STUDENT role by default.
    Checks if:
    1. Email already exists in users table (prevent duplicate registration)
    2. Institute ID exists (for non-super admins)
    3. Email exists in student_details table (for institute verification)
    """
    
    # Check if user already exists with this email in users table
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered. Please login instead."
        )
    
    # Set default role to STUDENT if not provided
    if not user.role:
        user.role = "STUDENT"
    
    # Validate institute for non-super admins
    if user.role != "SUPER_ADMIN":
        if not user.institute_id:
            raise HTTPException(
                status_code=400,
                detail="Institute ID is required for registration"
            )
        
        # Check if institute exists
        institute = db.query(Institute).filter(
            (Institute.institute_id == user.institute_id)
        ).first()
        
        if not institute:
            raise HTTPException(
                status_code=404,
                detail="Institute ID not found. Please provide a valid institute ID."
            )
        
        # Check if email exists in student_details table for this institute
        student = db.query(Student).filter(
            (Student.institute_id == user.institute_id) &
            (Student.email == user.email)
        ).first()
        
        if not student:
            raise HTTPException(
                status_code=404,
                detail="Email not found in student records. Please use your official institute email."
            )
    
    else:
        # For SUPER_ADMIN, institute_id can be null
        user.institute_id = None
    
    # Create new user
    new_user = User(
        email=user.email,
        password_hash=hash_password(user.password),
        role=user.role,
        institute_id=user.institute_id,
        is_active=user.is_active if user.is_active is not None else True
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Optional: Link student_id to user if found (for STUDENT role)
        if user.role == "STUDENT" and user.institute_id:
            student = db.query(Student).filter(
                (Student.institute_id == user.institute_id) &
                (Student.email == user.email)
            ).first()
            
            if student and student.student_id:
                # Update user with student_id
                new_user.student_id = student.student_id
                db.commit()
                db.refresh(new_user)
        
        return {
            "message": "User created successfully",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
            "institute_id": new_user.institute_id,
            "is_active": new_user.is_active,
            "created_at": new_user.created_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error creating user: {str(e)}"
        )

@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's profile information with additional student details if role is STUDENT
    """
    # Base profile data
    profile_data = {
        "email": current_user.email,
        "role": current_user.role,
        "institute_id": current_user.institute_id,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.strftime("%d %B %Y").lstrip("0") 
                     if current_user.created_at else "N/A",
    }
    
    # If user is a STUDENT, fetch additional student details
    if current_user.role == "STUDENT":
        student_details = {}
        
        student = db.query(Student).filter(
            Student.email == current_user.email,
            Student.institute_id == current_user.institute_id
        ).first()
        
            
        if student:
                student_details = {
                    "roll_no": student.roll_no,
                    "class": student.standard,  # Using 'class' key for frontend, but storing as 'standard' in DB
                    "stream": student.stream,
                    "full_name": student.full_name,
                    "student_id": student.student_id,
                }
        else:
            # Fallback: Try to find student by email if student_id is not set
            student = db.query(Student).filter(
                Student.email == current_user.email,
                Student.institute_id == current_user.institute_id
            ).first()
            
            if student:
                # Update user's student_id for future reference
                current_user.student_id = student.student_id
                db.commit()
                
                student_details = {
                    "roll_no": student.roll_no,
                    "class": student.standard,
                    "stream": student.stream,
                    "full_name": student.full_name,
                    "student_id": student.student_id,
                }
        
        # Add student details to profile data
        profile_data.update(student_details)
    
    # If user is ADMIN or FACULTY, you can add their specific details here
    elif current_user.role == "ADMIN":
        # Add admin-specific details if needed
        profile_data["admin_specific_field"] = "Some admin data"
    
    return {
        "success": True,
        "data": profile_data
    }

@router.put("/profile/email")
def update_user_email(
    email_update: EmailUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's email only
    """
    new_email = email_update.email.strip().lower()
    
    if not new_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Check if new email already exists (excluding current user)
    existing_user = db.query(User).filter(
        User.email == new_email,
        User.id != current_user.id
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )
    
    # Update email
    current_user.email = new_email
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Email updated successfully",
        "data": {
            "email": current_user.email
        }
    }


@router.post("/profile/change-password")
def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change current user's password
    """
    # Validate input
    if not password_change.current_password or not password_change.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All password fields are required"
        )
    
    # Password strength validation
    if len(password_change.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    if not any(char.isupper() for char in password_change.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter"
        )
    
    if not any(char.islower() for char in password_change.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter"
        )
    
    if not any(char.isdigit() for char in password_change.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number"
        )
    
    special_chars = '!@#$%^&*(),.?":{}|<>'
    if not any(char in special_chars for char in password_change.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must contain at least one special character ({special_chars})"
        )
    
    # Verify current password
    if not verify_password(password_change.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check if new password is same as current password
    if verify_password(password_change.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password
    current_user.password_hash = hash_password(password_change.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }

@router.delete("/profile/delete-account", status_code=status.HTTP_200_OK)
def delete_user_account(
    confirmation: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete the current user's account and all associated data.
    This action is irreversible.
    
    Requires confirmation parameter with value "DELETE_MY_ACCOUNT" to proceed.
    """
    # Require explicit confirmation
    if confirmation != "DELETE_MY_ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation required. Send 'DELETE_MY_ACCOUNT' in the confirmation parameter."
        )
    
    try:
        # Check if user is SUPER_ADMIN and prevent deletion if they're the last one
        if current_user.role == "SUPER_ADMIN":
            # Count all super admins (including the current user)
            super_admin_count = db.query(User).filter(
                User.role == "SUPER_ADMIN",
                User.id != current_user.id  # Exclude current user from count
            ).count()
            
            if super_admin_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the last SUPER_ADMIN account"
                )
        
        # First, delete the user
        db.delete(current_user)
        db.commit()
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting account: {str(e)}"
        )