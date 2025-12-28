from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base

class Institute(Base):
    __tablename__ = "institute_details"

    id = Column(Integer, primary_key=True, index=True)

    institute_id = Column(String(50), unique=True, nullable=False)
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

    created_at = Column(DateTime, server_default=func.now())
