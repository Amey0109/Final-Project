# models/faculty.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Faculty(Base):
    __tablename__ = "faculty"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    institute_id = Column(
        String(100), 
        ForeignKey("institute_details.institute_id", ondelete="CASCADE"),
        nullable=False
    )
    status = Column(String(50), default="ACTIVE", nullable=False)
    is_active = Column(Boolean, default=True)
    
    # NEW: Single stream for each faculty
    stream = Column(String(100), nullable=True)  # e.g., "Science", "Commerce", "Arts"
    
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="faculty", foreign_keys=[user_id])
    institute = relationship("Institute", back_populates="faculty", foreign_keys=[institute_id])
    
    # Many-to-many relationship with classes (no stream here)
    assigned_classes = relationship(
        "FacultyClass", 
        back_populates="faculty",
        cascade="all, delete-orphan"
    )
    
    # Many-to-many relationship with students
    student_assignments = relationship(
        "FacultyStudent", 
        back_populates="faculty",
        cascade="all, delete-orphan"
    )
    
    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'ON_LEAVE', 'INACTIVE')", name="check_faculty_status"),
        UniqueConstraint("institute_id", "email", name="unique_institute_faculty_email"),
    )