from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Student(Base):
    __tablename__ = "student_details"
    
    student_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    roll_no = Column(String(100), nullable=False)
    standard = Column(String(50), nullable=True)
    stream = Column(String(100), nullable=True)
    image_folder = Column(String(500), nullable=True)
    registered_by = Column(String(255), nullable=True)
    registration_date = Column(Date, nullable=True)
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=True)
    institute_id = Column(String(100), ForeignKey("institute_details.institute_id", ondelete="CASCADE"), nullable=False)
    
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="student", foreign_keys=[user_id])
    institute = relationship("Institute", back_populates="students", foreign_keys=[institute_id])
    attendance = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    
    # New relationship for faculty assignments
    faculty_assignments = relationship(
        "FacultyStudent", 
        back_populates="student",
        cascade="all, delete-orphan"
    )
    
    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED')", name="check_student_status"),
        UniqueConstraint("institute_id", "roll_no", name="unique_institute_student_roll"),
    )