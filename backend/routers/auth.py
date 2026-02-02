from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from utils.jwt_handler import ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
from models.users import User
from schemas.auth import LoginSchema, TokenSchema
from utils.jwt_handler import create_access_token, verify_token
from utils.hashing import verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

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

@router.post("/login", response_model=TokenSchema)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Verify password
    if not verify_password(form_data.password, user.password_hash):
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
    
    # REMOVE this line since token column doesn't exist:
    # user.token = access_token
    
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

# Update logout function:
@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Verify token and get user
    payload = verify_token(token)
    if payload:
        user = db.query(User).filter(User.id == payload.get("user_id")).first()
        if user:
            user.is_active = False
            # REMOVE these lines since token column doesn't exist:
            # user.token = None
            user.token_expiry = None
            db.commit()
    
    return {"message": "Successfully logged out"}

@router.get("/check-status/{user_id}")
async def check_user_status(user_id: int, db: Session = Depends(get_db)):
    """Check if a user is currently active/inactive"""
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
def verify_user_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    return {
        "email": user.email,
        "role": user.role,
        "institute_id": user.institute_id,
        "is_active": user.is_active,
        "redirect_to": user.get_redirect_path()
    }