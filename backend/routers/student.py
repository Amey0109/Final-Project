# api/student.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from datetime import datetime, date, timedelta
import calendar
from typing import Optional, List
from database import get_db
from models import Attendance, Student, User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/student", tags=["student"])

def calculate_working_days(start_date: date, end_date: date) -> int:
    """Calculate working days (Monday to Friday) between two dates"""
    working_days = 0
    current_date = start_date
    
    while current_date <= end_date:
        # Monday = 0, Tuesday = 1, ..., Sunday = 6
        if current_date.weekday() < 5:  # 0-4 are Monday to Friday
            working_days += 1
        current_date += timedelta(days=1)
    
    return working_days

def get_month_boundaries(year: int, month: int):
    """Get first and last day of a month"""
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    return first_day, last_day

def get_academic_year_start() -> date:
    """Get academic year start date (February 1st of current year)"""
    current_year = datetime.now().year
    # If current month is January, academic year started last year February
    if datetime.now().month == 1:
        return date(current_year - 1, 2, 1)
    else:
        return date(current_year, 2, 1)

def should_count_as_absent(check_date: date) -> bool:
    """
    Determine if a date should be counted as absent.
    Rules:
    1. Future dates: Never count as absent
    2. Past dates before 9 PM on the same day: Don't count as absent yet
    3. Past dates after 9 PM: Count as absent if no attendance record
    """
    current_datetime = datetime.now()
    current_date = current_datetime.date()
    
    # Rule 1: Future dates
    if check_date > current_date:
        return False
    
    # Rule 2: Today before 9 PM
    if check_date == current_date:
        if current_datetime.hour < 21:  # Before 9 PM
            return False
    
    # Rule 3: All other cases (past dates after 9 PM, or yesterday and earlier)
    return True

def get_student_attendance_for_date_range(
    student_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session
) -> dict:
    """
    Get attendance data for a student in a date range
    Returns dict with present_dates and calculated absent_dates
    """
    # Get all attendance records for the date range
    attendance_records = db.query(Attendance).filter(
        and_(
            Attendance.student_id == student_id,
            Attendance.attendance_date >= start_date,
            Attendance.attendance_date <= end_date
        )
    ).all()
    
    # Get present dates as set
    present_dates = {record.attendance_date for record in attendance_records}
    
    # Calculate absent dates
    absent_dates = []
    current_date = start_date
    current_datetime = datetime.now()
    
    while current_date <= end_date:
        # Only count working days (Monday-Friday)
        if current_date.weekday() < 5:
            # Check if it's a future date
            is_future = current_date > current_datetime.date()
            
            # Check if student is absent
            if current_date not in present_dates:
                # Apply the rules for counting as absent
                if should_count_as_absent(current_date):
                    absent_dates.append(current_date)
                # For today before 9 PM, we don't count as absent yet
                elif current_date == current_datetime.date() and current_datetime.hour < 21:
                    pass  # Don't count as absent yet
                # Future dates are never absent
                elif is_future:
                    pass  # Don't count future dates as absent
            
        current_date += timedelta(days=1)
    
    return {
        "present_dates": present_dates,
        "absent_dates": absent_dates,
        "present_count": len(present_dates),
        "absent_count": len(absent_dates)
    }

@router.get("/dashboard/stats")
async def get_student_attendance_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive attendance statistics for student dashboard
    """
    try:
        # Get student info using email
        student = db.query(Student).filter(
            Student.email == current_user.email
        ).first()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        current_datetime = datetime.now()
        current_date = current_datetime.date()
        current_month = current_datetime.month
        current_year = current_datetime.year
        
        # Get academic year start date
        academic_start = get_academic_year_start()
        
        # Get first and last day of current month
        first_day_of_month, last_day_of_month = get_month_boundaries(current_year, current_month)
        
        # Calculate total working days in current month
        total_working_days = calculate_working_days(first_day_of_month, last_day_of_month)
        
        # 1. Academic Year Statistics (from February to today)
        academic_data = get_student_attendance_for_date_range(
            student.student_id, 
            academic_start, 
            current_date, 
            db
        )
        
        academic_working_days = calculate_working_days(academic_start, current_date)
        academic_attendance_percent = 0
        if academic_working_days > 0:
            academic_attendance_percent = round(
                (academic_data["present_count"] / academic_working_days) * 100, 
                1
            )
        
        # 2. Current Month Statistics
        month_data = get_student_attendance_for_date_range(
            student.student_id,
            first_day_of_month,
            min(current_date, last_day_of_month),  # Don't include future dates
            db
        )
        
        month_present_days = month_data["present_count"]
        month_absent_days = month_data["absent_count"]
        
        # Calculate working days so far (excluding future dates)
        month_working_days_so_far = calculate_working_days(
            first_day_of_month, 
            min(current_date, last_day_of_month)
        )
        
        month_attendance_percent = 0
        if month_working_days_so_far > 0:
            month_attendance_percent = round(
                (month_present_days / month_working_days_so_far) * 100, 
                1
            )
        
        # 3. Weekly Statistics (last 4 weeks)
        weekly_data = []
        for week_offset in range(4):
            week_end = current_date - timedelta(days=week_offset * 7)
            week_start = week_end - timedelta(days=6)
            
            week_data = get_student_attendance_for_date_range(
                student.student_id,
                week_start,
                week_end,
                db
            )
            
            week_working_days = calculate_working_days(week_start, week_end)
            week_percent = 0
            if week_working_days > 0:
                week_percent = round((week_data["present_count"] / week_working_days) * 100, 1)
            
            weekly_data.append({
                "week": f"Week {4-week_offset}",
                "attendance_percent": week_percent,
                "present_days": week_data["present_count"],
                "working_days": week_working_days
            })
        
        # 4. Recent Attendance (last 7 records)
        recent_attendance = db.query(Attendance).filter(
            Attendance.student_id == student.student_id
        ).order_by(Attendance.attendance_date.desc()).limit(7).all()
        
        recent_attendance_list = []
        for record in recent_attendance:
            recent_attendance_list.append({
                "date": record.attendance_date.strftime("%Y-%m-%d"),
                "formatted_date": record.attendance_date.strftime("%b %d, %Y"),
                "day_name": record.attendance_date.strftime("%A"),
                "status": "PRESENT",
                "time_in": record.created_at.strftime("%I:%M %p") if record.created_at else "",
                "remarks": "Face recognition verified",
                "recorded_by": "Face Recognition System"
            })
        
        # 5. Current streak (consecutive present days)
        streak = 0
        check_date = current_date
        while True:
            # Skip weekends for streak calculation
            if check_date.weekday() >= 5:  # Saturday or Sunday
                check_date -= timedelta(days=1)
                continue
            
            # Check if student was present on this day
            was_present = db.query(Attendance).filter(
                and_(
                    Attendance.student_id == student.student_id,
                    Attendance.attendance_date == check_date
                )
            ).first()
            
            if was_present:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                # Check if we should count this as absent
                if should_count_as_absent(check_date):
                    break
                else:
                    # It's today before 9 PM, don't break streak yet
                    if check_date == current_date:
                        check_date -= timedelta(days=1)
                    else:
                        break
        
        # 6. Student information
        student_info = {
            "student_id": student.student_id,
            "full_name": student.full_name,
            "roll_no": student.roll_no,
            "standard": student.standard or "Not set",
            "stream": student.stream or "Not set",
            "email": student.email or current_user.email or "",
            "phone": student.phone or "",
            "status": student.status,
            "is_active": student.is_active,
            "institute_id": student.institute_id,
            "registration_date": student.registration_date.strftime("%Y-%m-%d") if student.registration_date else None,
            "academic_year_start": academic_start.strftime("%Y-%m-%d")
        }
        
        # 7. Sidebar stats for quick view
        sidebar_stats = {
            "present_days": month_present_days,
            "absent_days": month_absent_days,
            "attendance_percent": month_attendance_percent,
            "working_days": month_working_days_so_far
        }
        
        return {
            "success": True,
            "data": {
                "student_info": student_info,
                "academic_stats": {
                    "start_date": academic_start.strftime("%Y-%m-%d"),
                    "attendance_percent": academic_attendance_percent,
                    "present_days": academic_data["present_count"],
                    "working_days": academic_working_days,
                    "current_streak": streak
                },
                "monthly_stats": {
                    "current_month": current_datetime.strftime("%B %Y"),
                    "present_days": month_present_days,
                    "absent_days": month_absent_days,
                    "working_days": month_working_days_so_far,
                    "attendance_percent": month_attendance_percent,
                    "total_month_working_days": total_working_days
                },
                "weekly_trend": weekly_data,
                "recent_attendance": recent_attendance_list,
                "sidebar_stats": sidebar_stats,
                "last_updated": datetime.now().isoformat(),
                "current_time": current_datetime.strftime("%I:%M %p"),
                "attendance_cutoff_time": "9:00 PM"
            }
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error details: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error fetching attendance stats: {str(e)}")

@router.get("/attendance/records")
async def get_student_attendance_records(
    month: Optional[int] = None,
    year: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get paginated attendance records with filtering
    Includes calculated absent days based on rules
    """
    try:
        student = db.query(Student).filter(
            Student.email == current_user.email
        ).first()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        current_datetime = datetime.now()
        current_date = current_datetime.date()
        
        # If no filters provided, default to current month and year
        if month is None:
            month = current_datetime.month
        if year is None:
            year = current_datetime.year
        
        # Get month boundaries
        first_day, last_day = get_month_boundaries(year, month)
        # Don't include future dates
        end_date = min(last_day, current_date)
        
        # Get attendance data for the date range
        attendance_data = get_student_attendance_for_date_range(
            student.student_id,
            first_day,
            end_date,
            db
        )
        
        # Combine present and absent records
        all_records = []
        
        # Add present records
        attendance_records = db.query(Attendance).filter(
            and_(
                Attendance.student_id == student.student_id,
                Attendance.attendance_date >= first_day,
                Attendance.attendance_date <= end_date
            )
        ).order_by(Attendance.attendance_date.desc()).all()
        
        for record in attendance_records:
            all_records.append({
                "id": record.id,
                "date": record.attendance_date.strftime("%Y-%m-%d"),
                "formatted_date": record.attendance_date.strftime("%B %d, %Y"),
                "day_name": record.attendance_date.strftime("%A"),
                "status": "PRESENT",
                "time_in": record.created_at.strftime("%I:%M %p") if record.created_at else "N/A",
                "recorded_by": "Face Recognition System",
                "remarks": "Automated attendance via face recognition",
                "institute_id": record.institute_id,
                "is_working_day": record.attendance_date.weekday() < 5
            })
        
        # Add absent records (only for working days)
        for absent_date in attendance_data["absent_dates"]:
            all_records.append({
                "id": None,
                "date": absent_date.strftime("%Y-%m-%d"),
                "formatted_date": absent_date.strftime("%B %d, %Y"),
                "day_name": absent_date.strftime("%A"),
                "status": "ABSENT",
                "time_in": "--",
                "recorded_by": "System",
                "remarks": "No attendance recorded",
                "institute_id": student.institute_id,
                "is_working_day": True
            })
        
        # Sort all records by date (newest first)
        all_records.sort(key=lambda x: x["date"], reverse=True)
        
        # Calculate pagination
        total_records = len(all_records)
        offset = (page - 1) * limit
        paginated_records = all_records[offset:offset + limit]
        
        # Calculate total pages
        total_pages = (total_records + limit - 1) // limit
        
        # Calculate statistics
        present_count = len([r for r in all_records if r["status"] == "PRESENT"])
        absent_count = len([r for r in all_records if r["status"] == "ABSENT"])
        attendance_percent = 0
        if total_records > 0:
            attendance_percent = round((present_count / total_records) * 100, 1)
        
        return {
            "success": True,
            "data": {
                "records": paginated_records,
                "statistics": {
                    "total_records": total_records,
                    "present_count": present_count,
                    "absent_count": absent_count,
                    "attendance_percent": attendance_percent
                },
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "total_records": total_records,
                    "records_per_page": limit
                },
                "filters": {
                    "month": month,
                    "year": year,
                    "date_range": {
                        "start": first_day.strftime("%Y-%m-%d"),
                        "end": end_date.strftime("%Y-%m-%d")
                    }
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance records: {str(e)}")

@router.get("/attendance/calendar/{year}/{month}")
async def get_monthly_attendance_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get attendance data for calendar view with proper absent calculation
    """
    try:
        student = db.query(Student).filter(
            Student.email == current_user.email
        ).first()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Get month boundaries
        first_day, last_day = get_month_boundaries(year, month)
        current_datetime = datetime.now()
        current_date = current_datetime.date()
        
        # Don't include future dates
        end_date = min(last_day, current_date)
        
        # Get attendance data for the month
        attendance_data = get_student_attendance_for_date_range(
            student.student_id,
            first_day,
            end_date,
            db
        )
        
        # Get all attendance records for the month
        attendance_records = db.query(Attendance).filter(
            and_(
                Attendance.student_id == student.student_id,
                Attendance.attendance_date >= first_day,
                Attendance.attendance_date <= end_date
            )
        ).all()
        
        # Create calendar data structure
        calendar_data = []
        check_date = first_day
        
        # Generate calendar for entire month
        while check_date <= last_day:
            is_working_day = check_date.weekday() < 5
            is_weekend = check_date.weekday() >= 5
            is_today = check_date == current_date
            is_future = check_date > current_date
            is_past = check_date < current_date
            
            # Determine status
            status = None
            time_in = None
            
            if check_date in attendance_data["present_dates"]:
                status = "PRESENT"
                # Get time info if present
                record = next((r for r in attendance_records if r.attendance_date == check_date), None)
                if record and record.created_at:
                    time_in = record.created_at.strftime("%I:%M %p")
            elif check_date in attendance_data["absent_dates"]:
                status = "ABSENT"
            elif is_future:
                status = "FUTURE"
            elif is_weekend:
                status = "WEEKEND"
            elif check_date == current_date and current_datetime.hour < 21:
                # Today before 9 PM - attendance not yet determined
                status = "PENDING"
            else:
                # Should not happen, but just in case
                status = "UNKNOWN"
            
            day_data = {
                "date": check_date.strftime("%Y-%m-%d"),
                "day": check_date.day,
                "day_name": check_date.strftime("%A"),
                "is_weekend": is_weekend,
                "is_today": is_today,
                "is_future": is_future,
                "is_working_day": is_working_day,
                "status": status,
                "time_in": time_in
            }
            
            calendar_data.append(day_data)
            check_date += timedelta(days=1)
        
        # Calculate month statistics (only for dates up to today)
        working_days = calculate_working_days(first_day, end_date)
        present_days = attendance_data["present_count"]
        absent_days = attendance_data["absent_count"]
        
        attendance_percent = 0
        if working_days > 0:
            attendance_percent = round((present_days / working_days) * 100, 1)
        
        return {
            "success": True,
            "data": {
                "year": year,
                "month": month,
                "month_name": datetime(year, month, 1).strftime("%B"),
                "calendar_data": calendar_data,
                "statistics": {
                    "total_days": (last_day - first_day).days + 1,
                    "days_so_far": (end_date - first_day).days + 1,
                    "working_days": working_days,
                    "present_days": present_days,
                    "absent_days": absent_days,
                    "attendance_percent": attendance_percent,
                    "future_days": max(0, (last_day - current_date).days) if current_date < last_day else 0
                },
                "attendance_rules": {
                    "cutoff_time": "9:00 PM",
                    "academic_year_start": get_academic_year_start().strftime("%Y-%m-%d"),
                    "counts_today_as_absent_after": "9:00 PM"
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching calendar data: {str(e)}")

@router.get("/profile")
async def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete student profile information
    """
    try:
        student = db.query(Student).filter(
            Student.email == current_user.email
        ).first()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Get current month attendance
        current_date = datetime.now()
        first_day_of_month = date(current_date.year, current_date.month, 1)
        
        month_data = get_student_attendance_for_date_range(
            student.student_id,
            first_day_of_month,
            current_date.date(),
            db
        )
        
        # Calculate working days so far this month
        working_days_so_far = calculate_working_days(first_day_of_month, current_date.date())
        month_percent = 0
        if working_days_so_far > 0:
            month_percent = round((month_data["present_count"] / working_days_so_far) * 100, 1)
        
        # Get academic year statistics
        academic_start = get_academic_year_start()
        academic_data = get_student_attendance_for_date_range(
            student.student_id,
            academic_start,
            current_date.date(),
            db
        )
        
        academic_working_days = calculate_working_days(academic_start, current_date.date())
        academic_percent = 0
        if academic_working_days > 0:
            academic_percent = round((academic_data["present_count"] / academic_working_days) * 100, 1)
        
        return {
            "success": True,
            "data": {
                "student": {
                    "student_id": student.student_id,
                    "full_name": student.full_name,
                    "roll_no": student.roll_no,
                    "standard": student.standard or "Not set",
                    "stream": student.stream or "Not set",
                    "email": student.email or current_user.email or "",
                    "phone": student.phone or "",
                    "status": student.status,
                    "is_active": student.is_active,
                    "institute_id": student.institute_id,
                    "registration_date": student.registration_date.strftime("%Y-%m-%d") if student.registration_date else None,
                    "created_at": student.created_at.isoformat() if student.created_at else None,
                    "updated_at": student.updated_at.isoformat() if student.updated_at else None
                },
                "attendance_summary": {
                    "current_month_percent": month_percent,
                    "current_month_present": month_data["present_count"],
                    "current_month_absent": month_data["absent_count"],
                    "working_days_so_far": working_days_so_far,
                    "academic_year_percent": academic_percent,
                    "academic_year_present": academic_data["present_count"],
                    "academic_year_working_days": academic_working_days,
                    "academic_year_start": academic_start.strftime("%Y-%m-%d")
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")