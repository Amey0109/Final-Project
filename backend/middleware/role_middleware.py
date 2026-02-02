from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from utils.jwt_handler import verify_token

async def role_middleware(request: Request, call_next):
    # Skip middleware for auth routes, docs, redoc, openapi.json, and root
    public_paths = [
        "/auth", 
        "/docs", 
        "/redoc", 
        "/openapi.json",
        "/",
        "/register-institute"
    ]
    
    if any(request.url.path.startswith(path) for path in public_paths):
        return await call_next(request)
    
    # Check for token in header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Not authenticated"}
        )
    
    token = auth_header.split("Bearer ")[1]
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid token"}
        )
    
    # Add user info to request state
    request.state.user_id = payload.get("user_id")
    request.state.user_role = payload.get("role")
    request.state.institute_id = payload.get("institute_id")
    
    # Role-based route protection
    if request.url.path.startswith("/super-admin/") and payload.get("role") != "SUPER_ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Access denied. SUPER_ADMIN role required."}
        )
    
    elif request.url.path.startswith("/admin/") and payload.get("role") not in ["SUPER_ADMIN", "ADMIN"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Access denied. ADMIN role required."}
        )
    
    elif request.url.path.startswith("/faculty/") and payload.get("role") not in ["SUPER_ADMIN", "ADMIN", "FACULTY"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Access denied. FACULTY role required."}
        )
    
    elif request.url.path.startswith("/student/") and payload.get("role") != "STUDENT":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Access denied. STUDENT role required."}
        )
    
    return await call_next(request)