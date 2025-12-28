from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base

#routers
from routers import institute
from routers import contact

app = FastAPI(title="NeuroFace AI API")

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(institute.router)
app.include_router(contact.router)

