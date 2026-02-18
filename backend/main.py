from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path

from database import engine, Base
from routers import institute, contact, users, auth, super_admin, admin,faculty_dashboard, student
from middleware.auth_middleware import auth_middleware

app = FastAPI(title="NeuroFace AI API")

Base.metadata.create_all(bind=engine)

BASE_DIR = Path(__file__).resolve().parent  # backend/
PROJECT_ROOT = BASE_DIR.parent              # Final Project/
UI_DIR = PROJECT_ROOT / "UI"

# ---------------- MIDDLEWARE ------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------- AUTH MIDDLEWARE -------------
app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)

# ---------------- ROUTERS ---------------------
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(institute.router)
app.include_router(super_admin.router)
app.include_router(admin.router)
app.include_router(faculty_dashboard.router)
app.include_router(student.router)
app.include_router(contact.router)

# ---------------- HEALTH ----------------------
@app.get("/health")
def health():
    return {"status": "NeuroFace AI API running"}


