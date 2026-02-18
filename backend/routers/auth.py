from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from utils.jwt_handler import ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
from models.users import User
from schemas.auth import LoginSchema, TokenSchema
from utils.jwt_handler import create_access_token, verify_token
from utils.hashing import verify_password
from pydantic import BaseModel



router = APIRouter(prefix="/auth", tags=["Authentication"])

# Only HTTP Bearer for authentication
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    return user

# Role-based dependency functions
async def get_super_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required",
        )
    return current_user

async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

async def get_faculty_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role not in ["FACULTY", "ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faculty privileges required",
        )
    return current_user

async def get_institute_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role not in ["FACULTY", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faculty or Admin privileges required",
        )
    return current_user

async def get_student_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role not in ["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student privileges required",
        )
    return current_user

# Login endpoint using custom request model
@router.post("/login", response_model=TokenSchema)
async def login(login_data: LoginSchema, db: Session = Depends(get_db)):
    # Find user by email (username field)
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Set user as active (is_active = True)
    user.is_active = True
    user.token_expiry = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Create token data
    token_data = {
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "institute_id": user.institute_id
    }
    
    access_token = create_access_token(data=token_data)
    
    db.commit()
    
    # Determine redirect path based on role
    role_paths = {
        "SUPER_ADMIN": "super-admin/dashboard",
        "ADMIN": "admin/dashboard",
        "FACULTY": "faculty/dashboard",
        "STUDENT": "student/dashboard"
    }
    redirect_path = role_paths.get(user.role, "/")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "redirect_to": redirect_path,
        "user_id": user.id,
        "institute_id": user.institute_id,
        "is_active": user.is_active
    }

# Update logout function to use HTTP Bearer
@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    
    # Verify token and get user
    payload = verify_token(token)
    if payload:
        user_email = payload.get("sub")
        if user_email:
            user = db.query(User).filter(User.email == user_email).first()
            if user:
                user.is_active = False
                user.token_expiry = None
                db.commit()
    
    return {"message": "Successfully logged out"}

@router.get("/check-status/{user_id}")
async def check_user_status(
    user_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Check if a user is currently active/inactive"""
    
    # First authenticate the requesting user
    await get_current_user(credentials, db)
    
    # Then check the target user status
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "email": user.email,
        "is_active": user.is_active,
        "role": user.role,
        "last_active": user.token_expiry  
    }

@router.get("/verify-token")
def verify_user_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Determine redirect path
    role_paths = {
        "SUPER_ADMIN": "super-admin/dashboard",
        "ADMIN": "admin/dashboard",
        "FACULTY": "faculty/dashboard",
        "STUDENT": "student/dashboard"
    }
    redirect_path = role_paths.get(user.role, "/")
    
    return {
        "email": user.email,
        "role": user.role,
        "institute_id": user.institute_id,
        "is_active": user.is_active,
        "redirect_to": redirect_path
    }

# Additional helper endpoint to get current user info
@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    role_paths = {
        "SUPER_ADMIN": "super-admin/dashboard",
        "ADMIN": "admin/dashboard",
        "FACULTY": "faculty/dashboard",
        "STUDENT": "student/dashboard"
    }
    redirect_path = role_paths.get(current_user.role, "/")
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "institute_id": current_user.institute_id,
        "is_active": current_user.is_active,
        "redirect_to": redirect_path
    }