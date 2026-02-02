# routers/faculty_dashboard.py - Updated version with image upload
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date, timedelta
import os
import shutil
import uuid

from database import get_db
from models.faculty import Faculty
from models.faculty_class import FacultyClass
from models.faculty_student import FacultyStudent
from models.student import Student
from models.attendance import Attendance
from schemas.admin import FacultyDashboardStats, FacultyClassResponse, DashboardStats
from schemas.student import StudentCreate, StudentResponse
from schemas.admin import FacultyStudentResponse
from routers.auth import get_current_user

router = APIRouter(
    prefix="/api/faculty",
    tags=["Faculty"]
)

# Configure image upload settings
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_image_file(file: UploadFile):
    """Validate uploaded image file"""
    # Check file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    return file_ext

# Student Registration with Image Upload
@router.post("/students/register", response_model=StudentResponse)
async def register_student_by_faculty_with_image(
    full_name: str = Form(...),
    roll_no: str = Form(...),
    standard: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    stream: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Register a new student with optional image upload
    """
    # Check if user is faculty
    if current_user.role != "FACULTY":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty members can register students"
        )
    
    # Get faculty profile
    faculty = db.query(Faculty).filter(
        Faculty.user_id == current_user.id,
        Faculty.is_active == True
    ).first()
    
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found"
        )
    
    institute_id = faculty.institute_id
    
    # Check if roll number already exists in institute
    existing_student = db.query(Student).filter(
        Student.institute_id == institute_id,
        Student.roll_no == roll_no
    ).first()
    
    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Student with this roll number already exists in this institute"
        )
    
    # Validate that faculty can register this student
    if standard:
        # Check if faculty teaches this class
        faculty_class = db.query(FacultyClass).filter(
            FacultyClass.faculty_id == faculty.id,
            FacultyClass.class_name == standard
        ).first()
        
        if not faculty_class:
            raise HTTPException(
                status_code=403,
                detail=f"You are not assigned to teach class {standard}"
            )
    
    # Check stream compatibility
    if stream and faculty.stream:
        if stream != faculty.stream:
            raise HTTPException(
                status_code=403,
                detail=f"You can only register students in {faculty.stream} stream"
            )
    
    # Extract first name from full name for image folder
    first_name = full_name.split()[0] if full_name else "Student"
    
    # Generate temporary student ID for folder name
    temp_id = int(datetime.utcnow().timestamp())
    image_folder_path = f"C:\\Users\\Amey Gurav\\OneDrive\\Desktop\\Final Project\\Face-Recognition-Attendance-System\\Students\\{temp_id}_{first_name}"
    
    # Save image if provided
    saved_image_name = None
    if image and image.filename:
        try:
            file_ext = validate_image_file(image)
            
            # Generate unique filename
            unique_id = str(uuid.uuid4())[:8]
            saved_image_name = f"profile_{unique_id}{file_ext}"
            
            # Create the directory
            os.makedirs(image_folder_path, exist_ok=True)
            
            # Save image
            image_path = os.path.join(image_folder_path, saved_image_name)
            with open(image_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
                
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error saving image: {str(e)}"
            )
    
    try:
        # Create the student record WITH image_folder
        new_student = Student(
            full_name=full_name,
            roll_no=roll_no,
            standard=standard,
            stream=stream,
            email=email,
            phone=phone,
            institute_id=institute_id,
            registered_by=faculty.id,
            registration_date=date.today(),
            is_active=True,
            status='ACTIVE',
            image_folder=image_folder_path  # Set image folder with temp ID
        )
        
        db.add(new_student)
        db.commit()
        db.refresh(new_student)
        
        # Now update the image folder with actual student_id
        actual_image_folder = f"C:\\Users\\Amey Gurav\\OneDrive\\Desktop\\Final Project\\Face-Recognition-Attendance-System\\Students\\{new_student.student_id}_{first_name}"
        
        # If we have an image saved, move it to the new folder
        if saved_image_name and os.path.exists(image_folder_path):
            # Create new directory
            os.makedirs(actual_image_folder, exist_ok=True)
            
            # Move the image file
            old_image_path = os.path.join(image_folder_path, saved_image_name)
            new_image_path = os.path.join(actual_image_folder, saved_image_name)
            
            if os.path.exists(old_image_path):
                shutil.move(old_image_path, new_image_path)
            
            # Remove old directory if empty
            try:
                if os.path.exists(image_folder_path) and not os.listdir(image_folder_path):
                    os.rmdir(image_folder_path)
            except:
                pass  # Ignore error if directory not empty
        
        # Update the student record with correct image_folder
        new_student.image_folder = actual_image_folder
        db.commit()
        db.refresh(new_student)
        
        # Auto-assign student to this faculty
        try:
            existing_assignment = db.query(FacultyStudent).filter(
                FacultyStudent.faculty_id == faculty.id,
                FacultyStudent.student_id == new_student.student_id
            ).first()
            
            if not existing_assignment:
                assignment = FacultyStudent(
                    faculty_id=faculty.id,
                    student_id=new_student.student_id
                )
                db.add(assignment)
                db.commit()
        
        except Exception as e:
            # Log error but don't fail student creation
            print(f"Error assigning student to faculty: {str(e)}")
            # Continue without assignment
        
        return new_student
        
    except Exception as e:
        # Clean up created directory if student creation fails
        if os.path.exists(image_folder_path):
            try:
                shutil.rmtree(image_folder_path)
            except:
                pass
        
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error registering student: {str(e)}"
        )

# Function for faculty-specific dashboard stats
@router.get("/stats", response_model=FacultyDashboardStats)
async def get_faculty_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get faculty-specific dashboard statistics
    """
    # Get faculty profile
    faculty = db.query(Faculty).filter(
        Faculty.user_id == current_user.id,
        Faculty.is_active == True
    ).first()
    
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty profile not found")
    
    institute_id = faculty.institute_id
    today = date.today()
    
    # 1. Get faculty's assigned classes count
    my_classes_count = db.query(FacultyClass).filter(
        FacultyClass.faculty_id == faculty.id
    ).count()
    
    # 2. Get faculty's assigned students count
    my_students_count = db.query(FacultyStudent).filter(
        FacultyStudent.faculty_id == faculty.id,
        FacultyStudent.is_active == True
    ).count()
    
    # 3. Get faculty's assigned student IDs
    faculty_student_ids = db.query(FacultyStudent.student_id).filter(
        FacultyStudent.faculty_id == faculty.id,
        FacultyStudent.is_active == True
    ).all()
    faculty_student_ids = [fs[0] for fs in faculty_student_ids]
    
    # 4. Calculate today's attendance for faculty's students
    if faculty_student_ids:
        today_faculty_present = db.query(Attendance).filter(
            Attendance.student_id.in_(faculty_student_ids),
            Attendance.attendance_date == today
        ).count()
        
        today_faculty_attendance_rate = (today_faculty_present / len(faculty_student_ids)) * 100
        today_faculty_absent = len(faculty_student_ids) - today_faculty_present
    else:
        today_faculty_present = 0
        today_faculty_attendance_rate = 0
        today_faculty_absent = 0
    
    # 5. Weekly trend for faculty's students
    weekly_trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        
        if faculty_student_ids:
            day_faculty_present = db.query(Attendance).filter(
                Attendance.student_id.in_(faculty_student_ids),
                Attendance.attendance_date == day
            ).count()
            
            day_rate = (day_faculty_present / len(faculty_student_ids)) * 100 if len(faculty_student_ids) > 0 else 0
        else:
            day_faculty_present = 0
            day_rate = 0
        
        weekly_trend.append({
            "date": day.strftime("%Y-%m-%d"),
            "day_name": day.strftime("%A")[:3],
            "attendance_rate": round(day_rate, 1),
            "total": len(faculty_student_ids),
            "present": day_faculty_present
        })
    
    # 6. Calculate weekly average attendance
    weekly_average = 0
    if weekly_trend:
        total_rate = sum(day["attendance_rate"] for day in weekly_trend)
        weekly_average = total_rate / len(weekly_trend)
    
    # 7. Get assigned classes
    assigned_classes = db.query(FacultyClass).filter(
        FacultyClass.faculty_id == faculty.id
    ).order_by(FacultyClass.class_name).all()
    
    assigned_classes_response = [
        FacultyClassResponse(
            class_name=fc.class_name,
            created_at=fc.created_at
        )
        for fc in assigned_classes
    ]
    
    return FacultyDashboardStats(
        my_students=my_students_count,
        my_classes=my_classes_count,
        today_attendance_rate=round(today_faculty_attendance_rate, 1),
        today_present=today_faculty_present,
        today_absent=today_faculty_absent,
        today_total=len(faculty_student_ids),
        weekly_average_attendance=round(weekly_average, 1),
        assigned_classes=assigned_classes_response,
        weekly_trend=weekly_trend
    )


    
# Get faculty's students
@router.get("/students", response_model=List[FacultyStudentResponse])
async def get_faculty_students(
    skip: int = 0,
    limit: int = 100,
    class_filter: Optional[str] = Query(None, alias="class"),
    stream_filter: Optional[str] = Query(None, alias="stream"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get students assigned to the current faculty member
    """
    if current_user.role != "FACULTY":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty members can access this endpoint"
        )
    
    # Get faculty profile
    faculty = db.query(Faculty).filter(
        Faculty.user_id == current_user.id,
        Faculty.is_active == True
    ).first()
    
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found"
        )
    
    # Build query for faculty's students
    query = db.query(Student).join(
        FacultyStudent, Student.student_id == FacultyStudent.student_id
    ).filter(
        FacultyStudent.faculty_id == faculty.id,
        FacultyStudent.is_active == True,
        Student.is_active == True
    )
    
    # Apply filters
    if class_filter:
        query = query.filter(Student.standard == class_filter)
    
    if stream_filter:
        query = query.filter(Student.stream == stream_filter)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            and_(
                Student.full_name.ilike(search_term),
                Student.roll_no.ilike(search_term)
            )
        )
    
    # Get students
    students = query.order_by(
        Student.standard, 
        Student.roll_no
    ).offset(skip).limit(limit).all()
    
    # Format response with attendance percentage
    from utils.faculty_assignment import calculate_student_attendance_percentage
    
    result = []
    for student in students:
        attendance_percentage = calculate_student_attendance_percentage(
            student.student_id, 
            db
        )
        
        result.append(FacultyStudentResponse(
            student_id=student.student_id,
            roll_no=student.roll_no,
            full_name=student.full_name,
            standard=student.standard,
            stream=student.stream,
            email=student.email,
            phone=student.phone,
            image_folder=student.image_folder, 
            status=student.status,
            is_active=student.is_active,
            attendance_percentage=attendance_percentage,
            registered_by=student.registered_by,
            registration_date=student.registration_date,
            created_at=student.created_at,
             # Include image folder in response
        ))
    
    return result

# Update student information
@router.put("/students/{student_id}", response_model=StudentResponse)
async def update_student_by_faculty(
    student_id: int,
    student_update: StudentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update student information (only for faculty's assigned students)
    """
    if current_user.role != "FACULTY":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty members can update students"
        )
    
    # Get faculty profile
    faculty = db.query(Faculty).filter(
        Faculty.user_id == current_user.id,
        Faculty.is_active == True
    ).first()
    
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found"
        )
    
    # Check if student exists and is assigned to this faculty
    student = db.query(Student).join(
        FacultyStudent, Student.student_id == FacultyStudent.student_id
    ).filter(
        Student.student_id == student_id,
        FacultyStudent.faculty_id == faculty.id,
        FacultyStudent.is_active == True
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found or not assigned to you"
        )
    
    # Check roll number uniqueness if changing
    if student_update.roll_no != student.roll_no:
        existing = db.query(Student).filter(
            Student.institute_id == faculty.institute_id,
            Student.roll_no == student_update.roll_no,
            Student.student_id != student_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Another student with this roll number already exists"
            )
    
    # If name is being updated, we might want to update the image folder too
    if student_update.full_name != student.full_name:
        # Extract first name from updated full name
        first_name = student_update.full_name.split()[0] if student_update.full_name else ""
        
        # Update image folder path
        image_folder_path = f"C:\\Users\\Amey Gurav\\OneDrive\\Desktop\\Final Project\\Face-Recognition-Attendance-System\\Students\\{student_id}_{first_name}"
        
        # Update student fields
        update_data = student_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if value is not None:
                setattr(student, field, value)
        
        # Update image folder
        student.image_folder = image_folder_path
    else:
        # Just update other fields without changing image folder
        update_data = student_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if value is not None:
                setattr(student, field, value)
    
    student.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(student)
        return student
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error updating student: {str(e)}"
        )

# Add this import at the top if not already present


# Add this DELETE endpoint to your router
@router.delete("/students/{student_id}")
async def delete_student_completely(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Completely delete a student from all tables (hard delete)
    Only faculty members can delete their assigned students
    """
    # Check if user is faculty
    if current_user.role != "FACULTY":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only faculty members can delete students"
        )
    
    # Get faculty profile
    faculty = db.query(Faculty).filter(
        Faculty.user_id == current_user.id,
        Faculty.is_active == True
    ).first()
    
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found"
        )
    
    # Check if student exists and is assigned to this faculty
    student = db.query(Student).join(
        FacultyStudent, Student.student_id == FacultyStudent.student_id
    ).filter(
        Student.student_id == student_id,
        FacultyStudent.faculty_id == faculty.id,
        FacultyStudent.is_active == True
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found or not assigned to you"
        )
    
    try:
        # Store student info for response before deletion
        student_info = {
            "student_id": student.student_id,
            "full_name": student.full_name,
            "roll_no": student.roll_no,
            "class": student.standard,
            "email": student.email
        }
        
        # Start transaction
        # 1. Delete from attendance records first (child table)
        db.query(Attendance).filter(
            Attendance.student_id == student_id
        ).delete(synchronize_session=False)
        
        # 2. Delete from faculty_student assignments (many-to-many)
        db.query(FacultyStudent).filter(
            FacultyStudent.student_id == student_id
        ).delete(synchronize_session=False)
        
        # 3. Finally delete the student from student_details table
        db.query(Student).filter(
            Student.student_id == student_id
        ).delete(synchronize_session=False)
        
        # Commit all deletions
        db.commit()
        
        return {
            "success": True,
            "message": "Student deleted completely from all tables",
            "deleted_student": student_info
        }
        
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database integrity error while deleting student: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting student: {str(e)}"
        )