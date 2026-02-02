from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from database import SessionLocal

async def auth_middleware(request: Request, call_next):
    # Skip middleware for public routes
    public_paths = ["/auth/login", "/auth/logout", "/docs", "/redoc", "/openapi.json", "/", "/register-institute", "/users"]
    
    if any(request.url.path.startswith(path) for path in public_paths):
        return await call_next(request)
    
    # Check for Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Not authenticated"}
        )
    
    token = auth_header.split("Bearer ")[1]
    
    # Check database for token validity
    db: Session = SessionLocal()
    try:
        from models.users import User
        
        user = db.query(User).filter(User.token == token).first()
        
        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid token"}
            )
        
        # Check if token is expired
        if user.token_expiry and user.token_expiry < datetime.utcnow():
            # Auto logout - set is_active to False
            user.is_active = False
            user.token = None
            user.token_expiry = None
            db.commit()
            return JSONResponse(
                status_code=401,
                content={"detail": "Session expired. Please login again."}
            )
        
        # Check if user is active
        if not user.is_active:
            return JSONResponse(
                status_code=401,
                content={"detail": "User is not active. Please login."}
            )
        
        # Add user info to request state for use in endpoints
        request.state.user = user
        request.state.user_id = user.id
        request.state.user_role = user.role
        
        return await call_next(request)
        
    finally:
        db.close()