# utils/faculty_assignment.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import date, timedelta

# Import your models
from models.student import Student
from models.faculty import Faculty
from models.faculty_class import FacultyClass
from models.faculty_student import FacultyStudent
from models.attendance import Attendance


async def auto_assign_student_to_faculty(student: Student, db: Session) -> List[int]:
    """
    Automatically assign a student to faculty based on:
    1. Student's class (standard) matches faculty's assigned class
    2. Student's stream matches faculty's stream (single stream per faculty)
    
    Returns:
        List of faculty IDs the student was assigned to
    """
    if not student.standard:  # If no class specified, skip assignment
        return []
    
    # Find faculty who:
    # 1. Teaches this student's class (in faculty_classes)
    # 2. Has matching stream (in faculty table) OR no stream specified
    assigned_faculty = []
    
    try:
        # Get all faculty teaching this class
        faculty_teaching_class = db.query(Faculty).join(
            FacultyClass, Faculty.id == FacultyClass.faculty_id
        ).filter(
            FacultyClass.class_name == student.standard,
            Faculty.is_active == True,
            Faculty.status == 'ACTIVE'
        ).all()
        
        for faculty in faculty_teaching_class:
            # Check stream compatibility:
            # 1. If faculty has no stream (teaches all streams)
            # 2. If faculty stream matches student stream
            # 3. If student has no stream, assign to faculty with no stream
            if (
                faculty.stream is None or  # Faculty teaches all streams
                faculty.stream == student.stream or  # Streams match
                student.stream is None  # Student has no stream
            ):
                # Check if not already assigned
                existing_assignment = db.query(FacultyStudent).filter(
                    FacultyStudent.faculty_id == faculty.id,
                    FacultyStudent.student_id == student.student_id
                ).first()
                
                if not existing_assignment:
                    # Create new assignment
                    assignment = FacultyStudent(
                        faculty_id=faculty.id,
                        student_id=student.student_id
                    )
                    db.add(assignment)
                    assigned_faculty.append(faculty.id)
        
        if assigned_faculty:
            db.commit()
            
    except Exception as e:
        db.rollback()
        # Log the error but don't crash the student registration
        print(f"Error auto-assigning student {student.student_id} to faculty: {str(e)}")
    
    return assigned_faculty

def calculate_student_attendance_percentage(student_id: int, db: Session, days_back: int = 30) -> float:
    """
    Calculate attendance percentage for a student over last N days
    """
    # Count total school days in last N days (excluding weekends)
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    # Generate list of school days (Monday-Friday)
    school_days = []
    current_date = start_date
    while current_date <= end_date:
        # Check if it's a weekday (0=Monday, 4=Friday)
        if current_date.weekday() < 5:
            school_days.append(current_date)
        current_date += timedelta(days=1)
    
    total_school_days = len(school_days)
    
    if total_school_days == 0:
        return 0.0
    
    # Count attendance records for this student
    attendance_records = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.attendance_date >= start_date,
        Attendance.attendance_date <= end_date
    ).all()
    
    # For AI-recorded attendance: if record exists → PRESENT
    present_days = len(attendance_records)
    
    # Calculate percentage
    percentage = (present_days / total_school_days) * 100
    
    return round(percentage, 2)
