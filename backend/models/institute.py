from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Institute(Base):
    __tablename__ = "institute_details"

    institute_id = Column(String, primary_key=True, index=True)
    institute_name = Column(String(255), nullable=False)
    address = Column(Text, nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    institute_type = Column(String(50), nullable=False)
    student_count = Column(Integer, nullable=False)
    contact_person = Column(String(255), nullable=False)
    subscription_plan = Column(String(20), nullable=False)
    payment_method = Column(String(20), nullable=False)
    payment_status = Column(String(20), default="PAID")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="institute", cascade="all, delete-orphan")
    faculty = relationship("Faculty", back_populates="institute")
    students = relationship("Student", back_populates="institute")
    attendance_records = relationship("Attendance", back_populates="institute")