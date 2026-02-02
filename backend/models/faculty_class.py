# models/faculty_class.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base

class FacultyClass(Base):
    __tablename__ = "faculty_classes"
    
    faculty_id = Column(Integer, ForeignKey("faculty.id", ondelete="CASCADE"), primary_key=True)
    class_name = Column(String(50), primary_key=True)  # e.g., "6th", "7th", "10th"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    faculty = relationship("Faculty", back_populates="assigned_classes")