# models/faculty_student.py
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from database import Base

class FacultyStudent(Base):
    __tablename__ = "faculty_students"
    
    faculty_id = Column(Integer, ForeignKey("faculty.id", ondelete="CASCADE"), primary_key=True)
    student_id = Column(Integer, ForeignKey("student_details.student_id", ondelete="CASCADE"), primary_key=True)
    assigned_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    faculty = relationship("Faculty", back_populates="student_assignments")
    student = relationship("Student", back_populates="faculty_assignments")