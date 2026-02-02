from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, and_, or_, desc, asc, text
from typing import List, Optional
from datetime import datetime, date, timedelta
import calendar
import pandas as pd
from io import BytesIO
import csv

from database import get_db
from models.users import User
from models.institute import Institute
from models.student import Student
from models.faculty import Faculty
from models.faculty_class import FacultyClass
from models.attendance import Attendance
from schemas.admin import(
    DashboardStats, FacultyCreate, FacultyResponse, FacultyUpdate,
    StudentResponse, AttendanceResponse, AttendanceCreate,
    BulkAttendanceCreate, AttendanceStats, WeeklyTrendItem,
    ExportRequest
)
from routers.auth import get_current_user
from utils.hashing import hash_password
from utils.reports_generator import ReportGenerator
router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Dashboard"]
)

async def get_institute_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure user is specifically an INSTITUTE ADMIN (not SUPER_ADMIN)
    """
    if current_user.role not in ["ADMIN", "FACULTY"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Institute Admin privileges required."
        )
    
    # Check if user account is active
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Please contact administrator."
        )
    
    # Check if institute is assigned
    if not current_user.institute_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No institute assigned to your account."
        )
    
    return current_user

# ==================== DASHBOARD API ====================
@router.get("/dashboard-stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get dashboard statistics:
    - Total Students
    - Today's Attendance
    - Active Faculty
    - Weekly Attendance Trend
    """
    institute_id = admin_user.institute_id
    
    # FIRST: Check if institute exists in the institute_details table
    institute = db.query(Institute).filter(
        Institute.institute_id == institute_id
    ).first()
    
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institute with ID '{institute_id}' not found. Please contact administrator."
        )
    
    # 1. Total Students
    try:
        total_students = db.query(Student).filter(
            Student.institute_id == institute_id,
            Student.is_active == True,
            Student.status == 'ACTIVE'
        ).count()
    except Exception as e:
        print(f"ERROR in student query: {str(e)}")
        total_students = 0
    
    # 2. Today's Attendance
    today = date.today()
    try:
        today_attendance_count = db.query(Attendance).filter(
            Attendance.institute_id == institute_id,
            Attendance.attendance_date == today
        ).count()
    except Exception as e:
        print(f"ERROR in attendance query: {str(e)}")
        today_attendance_count = 0
    
    # For AI-recorded attendance, every record is considered "present"
    today_present = today_attendance_count
    today_total = total_students
    today_absent = max(0, total_students - today_attendance_count)  # Students without attendance records
    
    if today_total > 0:
        today_attendance_rate = (today_present / today_total) * 100
    else:
        today_attendance_rate = 0
    
    # 3. Active Faculty
    try:
        active_faculty = db.query(Faculty).filter(
            Faculty.institute_id == institute_id,
            Faculty.is_active == True,
            Faculty.status == 'ACTIVE'
        ).count()
    except Exception as e:
        print(f"ERROR in faculty query: {str(e)}")
        active_faculty = 0
    
    # 4. Weekly Attendance Trend (Last 7 days including today)
    weekly_trend = []
    for i in range(6, -1, -1):  # 6 days ago to today
        day = today - timedelta(days=i)
        try:
            day_attendance_count = db.query(Attendance).filter(
                Attendance.institute_id == institute_id,
                Attendance.attendance_date == day
            ).count()
        except Exception as e:
            print(f"ERROR in weekly attendance query for {day}: {str(e)}")
            day_attendance_count = 0
        
        if total_students > 0:
            rate = (day_attendance_count / total_students) * 100
        else:
            rate = 0
        
        weekly_trend.append({
            "date": day.strftime("%Y-%m-%d"),
            "day_name": day.strftime("%A")[:3],
            "attendance_rate": round(rate, 1),
            "total": total_students,
            "present": day_attendance_count
        })
    
    return DashboardStats(
        total_students=total_students,
        today_attendance_rate=round(today_attendance_rate, 1),
        active_faculty=active_faculty,
        weekly_trend=weekly_trend,
        today_present=today_present,
        today_absent=today_absent,
        today_total=today_total
    )
# ==================== FACULTY MANAGEMENT API ====================
@router.get("/faculty", response_model=List[FacultyResponse])
async def get_faculty_list(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None)
):
    """
    Get list of all faculty members with their assigned classes
    """
    query = db.query(Faculty).filter(
        Faculty.institute_id == admin_user.institute_id
    )
    
    # Apply filters
    if status_filter:
        query = query.filter(Faculty.status == status_filter.upper())
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Faculty.full_name.ilike(search_term),
                Faculty.email.ilike(search_term),
                Faculty.employee_id.ilike(search_term)
            )
        )
    
    faculty_list = query.order_by(Faculty.created_at.desc()).all()
    
    result = []
    for faculty in faculty_list:
        # Get assigned classes as strings
        assigned_classes = db.query(FacultyClass.standard).filter(
            FacultyClass.faculty_id == faculty.id
        ).all()
        class_names = [cls[0] for cls in assigned_classes]  # Extract strings
        
        # Create response dictionary
        faculty_dict = {
            "id": faculty.id,
            "user_id": faculty.user_id,
            "full_name": faculty.full_name,
            "email": faculty.email,
            "phone": faculty.phone,
            "institute_id": faculty.institute_id,
            "stream": faculty.stream,
            "status": faculty.status,
            "is_active": faculty.is_active,
            "last_login": faculty.last_login,
            "created_at": faculty.created_at,
            "updated_at": faculty.updated_at,
            "assigned_classes": class_names  # List of strings
        }
        
        result.append(FacultyResponse(**faculty_dict))
    
    return result

@router.post("/faculty", response_model=FacultyResponse)
async def add_faculty(
    faculty_data: FacultyCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Add a new faculty member
    Creates both user account and faculty record
    Creates faculty_class assignments for multiple classes
    """
    institute_id = admin_user.institute_id
    
    # Check if email already exists in users table
    existing_user = db.query(User).filter(User.email == faculty_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    # Check if email already exists in faculty table for this institute
    existing_faculty = db.query(Faculty).filter(
        Faculty.email == faculty_data.email,
        Faculty.institute_id == institute_id
    ).first()
    
    if existing_faculty:
        raise HTTPException(
            status_code=400,
            detail="Faculty with this email already exists in this institute"
        )
    
    # Validate stream if provided
    if faculty_data.stream:
        valid_streams = ["Science", "Commerce", "Arts", "Technology", "General"]
        if faculty_data.stream not in valid_streams:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stream. Must be one of: {', '.join(valid_streams)}"
            )
    
    # Validate assigned_classes - now required
    if not faculty_data.assigned_classes:
        raise HTTPException(
            status_code=400,
            detail="At least one class must be assigned to faculty"
        )
    
    # Validate assigned classes
    assigned_classes = faculty_data.assigned_classes
    if not isinstance(assigned_classes, list):
        raise HTTPException(
            status_code=400,
            detail="assigned_classes must be a list"
        )
    
    # Remove duplicates and empty values
    assigned_classes = list(set([c.strip() for c in assigned_classes if c and c.strip()]))
    
    if len(assigned_classes) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one valid class must be assigned to faculty"
        )
    
    # Check if any class names are invalid
    for class_name in assigned_classes:
        if len(class_name) > 50:
            raise HTTPException(
                status_code=400,
                detail=f"Class name '{class_name}' is too long (max 50 characters)"
            )
    
    # Create user account for faculty
    new_user = User(
        email=faculty_data.email,
        password_hash=hash_password("faculty@123"),  # Default password
        role="FACULTY",
        institute_id=institute_id,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    try:
        # Create faculty record
        new_faculty = Faculty(
            user_id=new_user.id,
            full_name=faculty_data.full_name,
            email=faculty_data.email,
            phone=faculty_data.phone,
            institute_id=institute_id,
            stream=faculty_data.stream,  # Add stream field
            status="ACTIVE",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(new_faculty)
        db.commit()
        db.refresh(new_faculty)
        
        # Create faculty_class assignments for each class
        faculty_class_entries = []
        for class_name in assigned_classes:
            # Create new faculty class assignment
            faculty_class = FacultyClass(
                faculty_id=new_faculty.id,
                class_name=class_name
            )
            db.add(faculty_class)
            faculty_class_entries.append(faculty_class)
        
        db.commit()
        
        # FIX: Create response dictionary instead of using from_orm
        response_data = {
            "id": new_faculty.id,
            "user_id": new_faculty.user_id,
            "full_name": new_faculty.full_name,
            "email": new_faculty.email,
            "phone": new_faculty.phone,
            "institute_id": new_faculty.institute_id,
            "stream": new_faculty.stream,
            "status": new_faculty.status,
            "is_active": new_faculty.is_active,
            "last_login": new_faculty.last_login,
            "created_at": new_faculty.created_at,
            "updated_at": new_faculty.updated_at,
            "assigned_classes": assigned_classes  # Use the original string list
        }
        
        return FacultyResponse(**response_data)
        
    except Exception as e:
        db.rollback()
        # Delete the user if faculty creation fails
        db.delete(new_user)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Error creating faculty: {str(e)}"
        )

@router.put("/faculty/{faculty_id}", response_model=FacultyResponse)
async def update_faculty(
    faculty_id: int,
    faculty_update: FacultyUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Update faculty information including assigned classes
    """
    faculty = db.query(Faculty).filter(
        Faculty.id == faculty_id,
        Faculty.institute_id == admin_user.institute_id
    ).first()
    
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Validate assigned_classes if provided
    if faculty_update.assigned_classes is not None:
        assigned_classes = faculty_update.assigned_classes
        if not isinstance(assigned_classes, list):
            raise HTTPException(
                status_code=400,
                detail="assigned_classes must be a list"
            )
        
        # Remove duplicates and empty values
        assigned_classes = list(set([c.strip() for c in assigned_classes if c and c.strip()]))
        
        if len(assigned_classes) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one valid class must be assigned to faculty"
            )
    
    # Update fields if provided
    update_data = faculty_update.dict(exclude_unset=True)
    
    # Handle status and is_active logic
    if 'status' in update_data:
        new_status = update_data['status']
        
        # Update is_active based on status
        if new_status == 'ACTIVE':
            faculty.is_active = True
        elif new_status == 'INACTIVE':
            faculty.is_active = False
        
        # Remove is_active from update_data if it exists to prevent override
        update_data.pop('is_active', None)
    
    # Handle assigned classes update
    if 'assigned_classes' in update_data:
        assigned_classes = update_data.pop('assigned_classes')
        
        # Remove existing class assignments
        db.query(FacultyClass).filter(
            FacultyClass.faculty_id == faculty_id
        ).delete()
        
        # Add new class assignments
        for class_name in assigned_classes:
            faculty_class = FacultyClass(
                faculty_id=faculty_id,
                class_name=class_name
            )
            db.add(faculty_class)
    
    # Update other fields
    for field, value in update_data.items():
        setattr(faculty, field, value)
    
    faculty.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(faculty)
        
        # Get updated assigned classes as STRINGS
        assigned_classes = db.query(FacultyClass.class_name).filter(
            FacultyClass.faculty_id == faculty_id
        ).all()
        class_names = [cls[0] for cls in assigned_classes]  # Extract strings
        
        # Create response with assigned classes as strings
        response_data = {
            "id": faculty.id,
            "user_id": faculty.user_id,
            "full_name": faculty.full_name,
            "email": faculty.email,
            "phone": faculty.phone,
            "institute_id": faculty.institute_id,
            "stream": faculty.stream,
            "status": faculty.status,
            "is_active": faculty.is_active,
            "last_login": faculty.last_login,
            "created_at": faculty.created_at,
            "updated_at": faculty.updated_at,
            "assigned_classes": class_names  # List of strings
        }
        
        return FacultyResponse(**response_data)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error updating faculty: {str(e)}"
        )
    
@router.delete("/faculty/{faculty_id}")
async def delete_faculty(
    faculty_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Delete a faculty member (soft delete - sets is_active to False)
    """
    faculty = db.query(Faculty).filter(
        Faculty.id == faculty_id,
        Faculty.institute_id == admin_user.institute_id
    ).first()
    
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Soft delete - set is_active to False
    faculty.is_active = False
    faculty.status = "INACTIVE"
    faculty.updated_at = datetime.utcnow()
    
    # Also deactivate the user account
    if faculty.user_id:
        user = db.query(User).filter(User.id == faculty.user_id).first()
        if user:
            user.is_active = False
    
    try:
        db.commit()
        return {"message": "Faculty deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting faculty: {str(e)}"
        )

# ==================== STUDENT MANAGEMENT API ====================
@router.get("/students", response_model=List[StudentResponse])
async def get_students_list(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin),
    class_filter: Optional[str] = Query(None, alias="standard"),
    stream_filter: Optional[str] = Query(None, alias="stream"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None)
):
    """
    Get list of all students
    Returns empty list with message in response headers if no students found
    """
    institute_id = admin_user.institute_id
    
    print(f"DEBUG: Getting students for institute: {institute_id}")
    
    try:
        # First check if institute exists
        institute = db.query(Institute).filter(
            Institute.institute_id == institute_id
        ).first()
        
        if not institute:
            # Return response with custom header
            response = Response()
            response.headers["X-Message"] = "Institute not found"
            response.status_code = 200
            return []
        
        # Build query
        query = db.query(Student).filter(
            Student.institute_id == institute_id,
            Student.is_active == True
        )
        
        # Apply filters
        if class_filter:
            query = query.filter(Student.standard == class_filter)
        
        if stream_filter:
            query = query.filter(Student.stream == stream_filter)
        
        if status_filter:
            status_filter = status_filter.upper()
            query = query.filter(Student.status == status_filter)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Student.full_name.ilike(search_term),
                    Student.roll_no.ilike(search_term),
                    Student.email.ilike(search_term)
                )
            )
        
        students = query.order_by(Student.roll_no).all()
        
        print(f"DEBUG: Found {len(students)} students for institute {institute_id}")
        
        if len(students) == 0:
            # Return response with custom header
            response = Response()
            response.headers["X-Message"] = "No students registered in this institute"
            response.headers["X-Total-Count"] = "0"
            response.status_code = 200
            return []
        
        return students
        
    except Exception as e:
        print(f"ERROR in get_students_list: {str(e)}")
        # If there's a foreign key constraint error, return empty list
        if "foreign key constraint" in str(e).lower():
            print(f"WARNING: Foreign key constraint issue for institute {institute_id}")
            response = Response()
            response.headers["X-Message"] = "Database constraint error. Please contact administrator."
            response.headers["X-Total-Count"] = "0"
            response.status_code = 200
            return []
        else:
            # Re-raise other errors
            raise HTTPException(
                status_code=500,
                detail=f"Error retrieving students: {str(e)}"
            )

@router.get("/students/{student_id}", response_model=StudentResponse)
async def get_student_details(
    student_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get detailed information about a student
    """
    student = db.query(Student).filter(
        Student.student_id == student_id,
        Student.institute_id == admin_user.institute_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return student

# ==================== ATTENDANCE MANAGEMENT API ====================
# ==================== ATTENDANCE MANAGEMENT API ====================
@router.get("/attendance/daily", response_model=List[AttendanceResponse])
async def get_daily_attendance(
    date: date = Query(..., description="Attendance date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get attendance for a specific date
    """
    attendance_records = db.query(Attendance).filter(
        Attendance.institute_id == admin_user.institute_id,
        Attendance.attendance_date == date
    ).all()
    
    # Get student details for each attendance record
    result = []
    for record in attendance_records:
        student = db.query(Student).filter(Student.student_id == record.student_id).first()
        if student:
            result.append(AttendanceResponse(
                id=record.id,
                student_id=record.student_id,
                student_name=student.full_name,
                roll_no=student.roll_no,
                class_name=student.standard,
                stream=student.stream,
                attendance_date=record.attendance_date,
                recorded_by=record.recorded_by,
                institute_id=record.institute_id,
                created_at=record.created_at
            ))
    
    return result

@router.post("/attendance/mark")
async def mark_attendance(
    attendance_data: BulkAttendanceCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Mark attendance for multiple students on a specific date
    """
    institute_id = admin_user.institute_id
    attendance_date = attendance_data.date
    records = attendance_data.attendance_records
    
    success_count = 0
    error_count = 0
    errors = []
    
    for record in records:
        student_id = record.get('student_id')
        
        if not student_id or not status:
            error_count += 1
            errors.append(f"Missing student_id or status in record: {record}")
            continue
        
        # Check if student exists and belongs to this institute
        student = db.query(Student).filter(
            Student.student_id == student_id,
            Student.institute_id == institute_id,
            Student.is_active == True
        ).first()
        
        if not student:
            error_count += 1
            errors.append(f"Student not found or not active: {student_id}")
            continue
        
        # Check if attendance already marked for this date
        existing_attendance = db.query(Attendance).filter(
            Attendance.student_id == student_id,
            Attendance.attendance_date == attendance_date
        ).first()
        
        try:
            if existing_attendance:
                # Update existing attendance
                existing_attendance.status = status
                existing_attendance.recorded_by = admin_user.id
            else:
                # Create new attendance record
                new_attendance = Attendance(
                    student_id=student_id,
                    attendance_date=attendance_date,
                    recorded_by=admin_user.id,
                    institute_id=institute_id,
                    created_at=datetime.utcnow()
                )
                db.add(new_attendance)
            
            success_count += 1
            
        except Exception as e:
            error_count += 1
            errors.append(f"Error processing student {student_id}: {str(e)}")
    
    try:
        db.commit()
        return {
            "message": "Attendance marked successfully",
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error saving attendance: {str(e)}"
        )

@router.get("/attendance/stats", response_model=AttendanceStats)
async def get_attendance_stats(
    date: date = Query(..., description="Date for statistics (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get attendance statistics for a specific date
    """
    institute_id = admin_user.institute_id
    
    # Get total active students
    total_students = db.query(Student).filter(
        Student.institute_id == institute_id,
        Student.is_active == True,
        Student.status == 'ACTIVE'
    ).count()
    
    # Get attendance count for the date
    attendance_count = db.query(Attendance).filter(
        Attendance.institute_id == institute_id,
        Attendance.attendance_date == date
    ).count()
    
    # For AI-recorded attendance:
    # - present_count = number of attendance records for that date
    # - absent_count = total students - present_count
    present_count = attendance_count
    absent_count = max(0, total_students - attendance_count)
    
    # Calculate attendance rate
    if total_students > 0:
        attendance_rate = (present_count / total_students) * 100
    else:
        attendance_rate = 0
    
    return AttendanceStats(
        date=date,
        total_students=total_students,
        present_count=present_count,
        absent_count=absent_count,
        late_count=0,  # Not applicable for AI-recorded attendance
        half_day_count=0,  # Not applicable for AI-recorded attendance
        attendance_rate=round(attendance_rate, 1)
    )

# ==================== EXPORT REPORTS API ====================
@router.post("/export")
async def export_reports(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Export reports in Excel, CSV, or PDF format
    """
    institute_id = admin_user.institute_id
    
    if export_request.report_type == "attendance":
        # Export attendance report
        query = db.query(
            Attendance,
            Student.full_name,
            Student.roll_no,
            Student.standard,
            Student.stream
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.institute_id == institute_id
        )
        
        if export_request.start_date:
            query = query.filter(Attendance.attendance_date >= export_request.start_date)
        if export_request.end_date:
            query = query.filter(Attendance.attendance_date <= export_request.end_date)
        if export_request.batch:
            query = query.filter(Student.standard == export_request.batch)
        
        records = query.order_by(Attendance.attendance_date.desc()).all()
        
        # Prepare data for export
        data = []
        for record in records:
            attendance, student_name, roll_no, class_name, stream = record
            # Since attendance is AI-recorded, we can mark all as "Present"
            data.append({
                "Date": attendance.attendance_date.strftime("%Y-%m-%d"),
                "Roll No": roll_no,
                "Student Name": student_name,
                "Class": class_name or "",
                "Stream": stream or "",
                "Status": "Present",  # All AI-recorded attendance is considered Present
                "Recorded At": attendance.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
    elif export_request.report_type == "students":
        # Export student list
        query = db.query(Student).filter(
            Student.institute_id == institute_id,
            Student.is_active == True
        )
        
        if export_request.batch:
            query = query.filter(Student.standard == export_request.batch)
        
        students = query.order_by(Student.roll_no).all()
        
        data = []
        for student in students:
            data.append({
                "Roll No": student.roll_no,
                "Full Name": student.full_name,
                "Class": student.standard or "",
                "Stream": student.stream or "",
                "Email": student.email or "",
                "Phone": student.phone or "",
                "Status": student.status,
                "Registered By": student.register_by or "",
                "Register Date": student.register_date.strftime("%Y-%m-%d") if student.register_date else "",
                "Created At": student.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    elif export_request.report_type == "faculty":
        # Export faculty list
        faculty_list = db.query(Faculty).filter(
            Faculty.institute_id == institute_id,
            Faculty.is_active == True
        ).order_by(Faculty.created_at.desc()).all()
        
        data = []
        for faculty in faculty_list:
            data.append({
                "Full Name": faculty.full_name,
                "Email": faculty.email,
                "Phone": faculty.phone or "",
                "Employee ID": faculty.employee_id or "",
                "Designation": faculty.designation or "",
                "Status": faculty.status,
                "Last Login": faculty.last_login.strftime("%Y-%m-%d %H:%M:%S") if faculty.last_login else "",
                "Created At": faculty.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    # Export based on format
    if export_request.format == "excel":
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Report')
            writer._save()
        
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={export_request.report_type}_report.xlsx"}
        )
    
    elif export_request.format == "csv":
        output = BytesIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys() if data else [])
        writer.writeheader()
        writer.writerows(data)
        
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={export_request.report_type}_report.csv"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format")
    
# Add this to your router (replace the existing /reports/generate endpoint)

from datetime import datetime
from typing import Optional
from fastapi import Query

@router.post("/reports/generate")
async def generate_attendance_report(
    class_filter: Optional[str] = None,
    stream_filter: Optional[str] = None,
    date_filter: Optional[str] = Query(None, description="Date in DD-MM-YYYY format"),
    start_date: Optional[str] = Query(None, description="Start date in DD-MM-YYYY format"),
    end_date: Optional[str] = Query(None, description="End date in DD-MM-YYYY format"),
    format: str = "excel",
    include_summary: bool = True,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Generate and download attendance report in Excel, CSV, PDF or HTML format
    Accepts dates in DD-MM-YYYY format
    """
    institute_id = admin_user.institute_id
    
    try:
        # Parse dates from DD-MM-YYYY to date objects
        def parse_date(date_str: Optional[str]) -> Optional[date]:
            if not date_str:
                return None
            try:
                # Try DD-MM-YYYY format
                return datetime.strptime(date_str, "%d-%m-%Y").date()
            except ValueError:
                # Try YYYY-MM-DD format (for backward compatibility)
                try:
                    return datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid date format: {date_str}. Use DD-MM-YYYY format"
                    )
        
        parsed_date_filter = parse_date(date_filter)
        parsed_start_date = parse_date(start_date)
        parsed_end_date = parse_date(end_date)
        
        # Get institute details for report header
        institute = db.query(Institute).filter(
            Institute.institute_id == institute_id
        ).first()
        
        if not institute:
            raise HTTPException(
                status_code=404,
                detail="Institute not found"
            )
        
        # Build student query
        student_query = db.query(Student).filter(
            Student.institute_id == institute_id,
            Student.is_active == True,
            Student.status == 'ACTIVE'
        )
        
        # Apply filters
        if class_filter:
            student_query = student_query.filter(Student.standard == class_filter)
        
        if stream_filter:
            student_query = student_query.filter(Student.stream == stream_filter)
        
        students = student_query.all()
        
        if not students:
            # Return a 200 with empty data instead of error
            report_gen = ReportGenerator(institute.institute_name)
            
            # Create empty data report
            report_data = []
            statistics = {
                'total_students': 0,
                'average_attendance': 0,
                'present_count': 0,
                'absent_count': 0,
                'total_days': 0,
                'filtered_count': 0
            }
            
            filters = {
                'class_filter': class_filter or 'All',
                'stream_filter': stream_filter or 'All',
                'date_filter': date_filter,
                'start_date': start_date,
                'end_date': end_date,
                'institute_name': institute.institute_name
            }
            
            # Generate empty report
            content, content_type, filename = report_gen.generate_report(
                data=report_data,
                stats=statistics,
                filters=filters,
                format=format
            )
            
            return Response(
                content=content.getvalue(),
                media_type=content_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        # Determine date range
        if parsed_date_filter:
            # Single date
            start_date_obj = end_date_obj = parsed_date_filter
            total_days = 1
        elif parsed_start_date and parsed_end_date:
            # Date range
            start_date_obj = parsed_start_date
            end_date_obj = parsed_end_date
            total_days = (end_date_obj - start_date_obj).days + 1
        else:
            # Default: last 30 days
            end_date_obj = date.today()
            start_date_obj = end_date_obj - timedelta(days=29)
            total_days = 30
        
        # Get attendance data for each student
        report_data = []
        total_present_days = 0
        
        for student in students:
            # Get attendance records for this student in date range
            attendance_query = db.query(Attendance).filter(
                Attendance.student_id == student.student_id,
                Attendance.attendance_date >= start_date_obj,
                Attendance.attendance_date <= end_date_obj
            )
            
            present_days = attendance_query.count()
            
            # Calculate attendance percentage
            attendance_percentage = (present_days / total_days) * 100 if total_days > 0 else 0
            
            # Get last attendance date
            last_attendance = attendance_query.order_by(Attendance.attendance_date.desc()).first()
            
            report_data.append({
                'roll_no': student.roll_no,
                'student_name': student.full_name,
                'class_name': student.standard,
                'stream': student.stream,
                'attendance_percentage': attendance_percentage,
                'present_days': present_days,
                'total_days': total_days,
                'last_attendance': last_attendance.attendance_date if last_attendance else None,
                'email': student.email,
                'phone': student.phone
            })
            
            total_present_days += present_days
        
        # Calculate statistics
        total_students = len(students)
        average_attendance = sum(item['attendance_percentage'] for item in report_data) / total_students if total_students > 0 else 0
        absent_count = sum(1 for item in report_data if item['present_days'] == 0)
        
        statistics = {
            'total_students': total_students,
            'average_attendance': average_attendance,
            'present_count': total_present_days,
            'absent_count': absent_count,
            'total_days': total_days,
            'filtered_count': len(report_data)
        }
        
        filters = {
            'class_filter': class_filter or 'All',
            'stream_filter': stream_filter or 'All',
            'date_filter': date_filter,
            'start_date': start_date,
            'end_date': end_date,
            'institute_name': institute.institute_name
        }
        
        report_gen = ReportGenerator(institute.institute_name)
        
        # Generate report
        content, content_type, filename = report_gen.generate_report(
            data=report_data,
            stats=statistics,
            filters=filters,
            format=format
        )
        
        # Return the file
        return Response(
            content=content.getvalue(),
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        # Return proper JSON error instead of HTML
        raise HTTPException(
            status_code=500,
            detail=f"Error generating report: {str(e)}"
        )

# Also update the preview endpoint
@router.get("/reports/preview")
async def preview_attendance_report(
    class_filter: Optional[str] = None,
    stream_filter: Optional[str] = None,
    date_filter: Optional[str] = Query(None, description="Date in DD-MM-YYYY format"),
    start_date: Optional[str] = Query(None, description="Start date in DD-MM-YYYY format"),
    end_date: Optional[str] = Query(None, description="End date in DD-MM-YYYY format"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Preview attendance report data (returns JSON)
    Accepts dates in DD-MM-YYYY format
    """
    institute_id = admin_user.institute_id
    
    try:
        # Parse dates from DD-MM-YYYY to date objects
        def parse_date(date_str: Optional[str]) -> Optional[date]:
            if not date_str:
                return None
            try:
                # Try DD-MM-YYYY format
                return datetime.strptime(date_str, "%d-%m-%Y").date()
            except ValueError:
                # Try YYYY-MM-DD format (for backward compatibility)
                try:
                    return datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid date format: {date_str}. Use DD-MM-YYYY format"
                    )
        
        parsed_date_filter = parse_date(date_filter)
        parsed_start_date = parse_date(start_date)
        parsed_end_date = parse_date(end_date)
        
        # Build student query
        student_query = db.query(Student).filter(
            Student.institute_id == institute_id,
            Student.is_active == True,
            Student.status == 'ACTIVE'
        )
        
        # Apply filters
        if class_filter:
            student_query = student_query.filter(Student.standard == class_filter)
        
        if stream_filter:
            student_query = student_query.filter(Student.stream == stream_filter)
        
        students = student_query.limit(10).all()  # Limit to 10 for preview
        
        # Determine date range
        if parsed_date_filter:
            start_date_obj = end_date_obj = parsed_date_filter
            total_days = 1
        elif parsed_start_date and parsed_end_date:
            start_date_obj = parsed_start_date
            end_date_obj = parsed_end_date
            total_days = (end_date_obj - start_date_obj).days + 1
        else:
            # Default: last 7 days
            end_date_obj = date.today()
            start_date_obj = end_date_obj - timedelta(days=6)
            total_days = 7
        
        report_data = []
        
        for student in students:
            attendance_count = db.query(Attendance).filter(
                Attendance.student_id == student.student_id,
                Attendance.attendance_date >= start_date_obj,
                Attendance.attendance_date <= end_date_obj
            ).count()
            
            attendance_percentage = (attendance_count / total_days) * 100 if total_days > 0 else 0
            
            report_data.append({
                'roll_no': student.roll_no,
                'student_name': student.full_name,
                'class': student.standard,
                'stream': student.stream,
                'attendance_count': attendance_count,
                'attendance_percentage': attendance_percentage
            })
        
        return {
            'success': True,
            'data': report_data,
            'count': len(report_data),
            'filters': {
                'class': class_filter or 'All',
                'stream': stream_filter or 'All',
                'date_range': f"{start_date if start_date else start_date_obj.strftime('%d-%m-%Y')} to {end_date if end_date else end_date_obj.strftime('%d-%m-%Y')}",
                'total_days': total_days
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating preview: {str(e)}"
        )

# ==================== UTILITY API ====================
@router.get("/classes")
async def get_classes_list(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get list of unique classes in the institute
    """
    classes = db.query(Student.standard).filter(
        Student.institute_id == admin_user.institute_id,
        Student.standard.isnot(None),
        Student.is_active == True
    ).distinct().all()
    
    return [cls[0] for cls in classes if cls[0]]

@router.get("/streams")
async def get_streams_list(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_institute_admin)
):
    """
    Get list of unique streams in the institute
    """
    streams = db.query(Student.stream).filter(
        Student.institute_id == admin_user.institute_id,
        Student.stream.isnot(None),
        Student.is_active == True
    ).distinct().all()
    
    return [stream[0] for stream in streams if stream[0]]
