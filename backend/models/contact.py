from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base

class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    institution = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    subscribe = Column(String(5), default="false")  # yes / no
    created_at = Column(DateTime(timezone=True), server_default=func.now())
