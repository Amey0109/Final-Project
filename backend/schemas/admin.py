from pydantic import BaseModel, EmailStr, validator, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
import re

from enum import Enum

# Dashboard Schemas
class DashboardStats(BaseModel):
    total_students: int
    today_attendance_rate: float
    active_faculty: int
    weekly_trend: List[Dict[str, Any]]
    today_present: int
    today_absent: int
    today_total: int

# Faculty Schemas
class FacultyCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    stream: Optional[str] = None
    assigned_classes: List[str] = Field(..., min_items=1)  # Required, at least one class
    
    @validator('stream')
    def validate_stream(cls, v):
        if v is not None:
            valid_streams = ["Science", "Commerce", "Arts", "Technology", "General"]
            if v not in valid_streams:
                raise ValueError(f"Stream must be one of: {', '.join(valid_streams)}")
        return v
    
    @validator('assigned_classes')
    def validate_assigned_classes(cls, v):
        if not v:
            raise ValueError("At least one class must be assigned")
        
        # Remove duplicates and empty strings
        unique_classes = list(set([c.strip() for c in v if c and c.strip()]))
        
        if not unique_classes:
            raise ValueError("At least one valid class must be assigned")
        
        # Validate each class name length
        for class_name in unique_classes:
            if len(class_name) > 50:
                raise ValueError(f"Class name '{class_name}' is too long (max 50 characters)")
        
        return unique_classes

class FacultyUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    stream: Optional[str] = None
    status: Optional[str] = None
    assigned_classes: Optional[List[str]] = None
    
    @validator('stream')
    def validate_stream(cls, v):
        if v is not None:
            valid_streams = ["Science", "Commerce", "Arts", "Technology", "General"]
            if v not in valid_streams:
                raise ValueError(f"Stream must be one of: {', '.join(valid_streams)}")
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ["ACTIVE", "ON_LEAVE", "INACTIVE"]
            if v.upper() not in valid_statuses:
                raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.upper() if v else v
    
    @validator('assigned_classes')
    def validate_assigned_classes(cls, v):
        if v is not None:
            if not isinstance(v, list):
                raise ValueError("assigned_classes must be a list")
            
            if len(v) == 0:
                raise ValueError("If provided, assigned_classes must contain at least one class")
            
            # Remove duplicates and empty strings
            unique_classes = list(set([c.strip() for c in v if c and c.strip()]))
            
            if not unique_classes:
                raise ValueError("At least one valid class must be assigned")
            
            # Validate each class name length
            for class_name in unique_classes:
                if len(class_name) > 50:
                    raise ValueError(f"Class name '{class_name}' is too long (max 50 characters)")
            
            return unique_classes
        return v

class FacultyResponse(BaseModel):
    id: int
    user_id: Optional[int]
    full_name: str
    email: str
    phone: Optional[str]
    institute_id: str
    stream: Optional[str]
    status: str
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    assigned_classes: List[str]
    
    class Config:
        from_attributes = True

class FacultyClassCreate(BaseModel):
    class_name: str
    stream: Optional[str] = None

# Add to schemas/admin.py
class FacultyClassResponse(BaseModel):
    class_name: str
    stream: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class FacultyDashboardStats(BaseModel):
    my_students: int  # Total students assigned to this faculty
    my_classes: int  # Total unique classes assigned to this faculty
    today_attendance_rate: float  # Attendance rate of faculty's students today
    today_present: int  # How many of faculty's students are present today
    today_absent: int  # How many of faculty's students are absent today
    today_total: int  # Total students assigned to faculty
    weekly_average_attendance: float  # Average attendance rate for last 7 days
    assigned_classes: List[FacultyClassResponse]  # List of assigned classes with streams
    weekly_trend: List[Dict[str, Any]]  # Weekly attendance trend
    
    class Config:
        from_attributes = True

# Add to schemas/faculty.py or schemas/admin.py
class FacultyStudentResponse(BaseModel):
    student_id: int
    roll_no: str
    full_name: str
    standard: Optional[str]
    stream: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    image_folder: Optional[str]
    status: str
    is_active: bool
    attendance_percentage: Optional[float] = None
    registered_by: Optional[str]
    registration_date: Optional[date]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Student Schemas
class StudentResponse(BaseModel):
    student_id: int
    roll_no: str
    full_name: str
    class_name: Optional[str]
    stream: Optional[str]
    image_folder: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    institute_id: str
    status: str
    is_active: bool
    registered_by: Optional[str]
    registration_date: Optional[date]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Attendance Schemas
class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    roll_no: str
    class_name: Optional[str]
    attendance_date: date
    status: str
    recorded_by: Optional[str]
    institute_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AttendanceCreate(BaseModel):
    student_id: int
    attendance_date: Optional[date] = None
    status: str

class BulkAttendanceCreate(BaseModel):
    date: date
    attendance_records: List[Dict[str, Any]]  # List of {student_id: int, status: str}

class AttendanceStats(BaseModel):
    date: date
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    half_day_count: int
    attendance_rate: float

class WeeklyTrendItem(BaseModel):
    date: str
    day_name: str
    attendance_rate: float
    total: int
    present: int

# Export Schemas
class ExportRequest(BaseModel):
    report_type: str  # 'attendance', 'students', 'faculty'
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    batch: Optional[str] = None
    format: str = "excel"  # excel, csv, pdf

class ExportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    HTML = "html"
    
class AttendanceReportRequest(BaseModel):
    class_filter: Optional[str] = None
    stream_filter: Optional[str] = None
    date_filter: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    format: ExportFormat = ExportFormat.PDF
    include_summary: bool = True
    include_charts: bool = False
    include_details: bool = True
    include_trends: bool = False

class ReportStats(BaseModel):
    total_students: int
    average_attendance: float
    present_count: int
    absent_count: int
    total_days: int
    filtered_count: int

class AttendanceReportRecord(BaseModel):
    roll_no: str
    student_name: str
    class_name: Optional[str]
    stream: Optional[str]
    attendance_percentage: float
    present_days: int
    total_days: int
    last_attendance: Optional[date]

class AttendanceReportResponse(BaseModel):
    records: List[AttendanceReportRecord]
    statistics: ReportStats
    filters: Dict[str, Any]
    generated_at: datetime