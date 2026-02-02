from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "SUPER_ADMIN", "ADMIN", "FACULTY", "STUDENT"
    institute_id = Column(
        String,
        ForeignKey("institute_details.institute_id", ondelete="CASCADE"),  # FIXED
        nullable=True
    )
    is_active = Column(Boolean, default=True)
    token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - FIXED with foreign_keys
    institute = relationship("Institute", back_populates="users", foreign_keys=[institute_id])
    
    # Use string references with foreign_keys
    faculty = relationship(
        "Faculty", 
        back_populates="user", 
        uselist=False,
        foreign_keys="Faculty.user_id",  # String reference
        cascade="all, delete-orphan"
    )
    
    student = relationship(
        "Student", 
        back_populates="user", 
        uselist=False,
        foreign_keys="Student.user_id",  # String reference
        cascade="all, delete-orphan"
    )
    
    def get_redirect_path(self) -> str:
        """Get the dashboard path based on user role"""
        role_paths = {
            "SUPER_ADMIN": "/super-admin/dashboard",
            "ADMIN": "/admin/dashboard",
            "FACULTY": "/faculty/dashboard",
            "STUDENT": "/student/dashboard"
        }
        return role_paths.get(self.role, "/")