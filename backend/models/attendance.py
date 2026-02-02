from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_details.student_id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    institute_id = Column(
        String(100), 
        ForeignKey("institute_details.institute_id", ondelete="CASCADE"),  # FIXED
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships - FIXED
    student = relationship("Student", back_populates="attendance", foreign_keys=[student_id])
    institute = relationship("Institute", back_populates="attendance_records", foreign_keys=[institute_id])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("student_id", "attendance_date", name="unique_student_attendance_date"),
    )