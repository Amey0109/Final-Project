from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, Integer, case
from datetime import datetime, timedelta
from typing import List, Optional
import pandas as pd
from io import BytesIO

from database import get_db
from models.users import User
from models.institute import Institute
from routers.auth import get_super_admin_user

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])



@router.get("/dashboard-stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for super admin"""
    
    # Total institutes
    total_institutes = db.query(Institute).count()
    
    # Active/Inactive institutes - based on payment status
    active_institutes = db.query(Institute).filter(
        Institute.payment_status == "PAID"
    ).count()
    inactive_institutes = total_institutes - active_institutes
    
    # Total users by role
    total_users = db.query(User).count()
    admin_count = db.query(User).filter(User.role == "ADMIN").count()
    faculty_count = db.query(User).filter(User.role == "FACULTY").count()
    student_count = db.query(User).filter(User.role == "STUDENT").count()
    
    # Monthly revenue - FIXED to use correct plan names
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    monthly_revenue = db.query(
        func.sum(
            case(
                (Institute.subscription_plan == "monthly", 5000),  
                (Institute.subscription_plan == "annual", 50000),  
                else_=0
            )
        )
    ).filter(
        Institute.payment_status == "PAID",
        func.extract('month', Institute.created_at) == current_month,
        func.extract('year', Institute.created_at) == current_year
    ).scalar() or 0
    
    # Growth calculations - calculate actual growth
    first_day_current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month = first_day_current_month - timedelta(days=1)
    last_month_year = last_month.year
    last_month_month = last_month.month
    
    last_month_revenue = db.query(
        func.sum(
            case(
                (Institute.subscription_plan == "Monthly", 5000),
                (Institute.subscription_plan == "Annual", 50000),
                else_=0
            )
        )
    ).filter(
        Institute.payment_status == "PAID",
        func.extract('month', Institute.created_at) == last_month_month,
        func.extract('year', Institute.created_at) == last_month_year
    ).scalar() or 0
    
    revenue_growth = 0
    if last_month_revenue > 0:
        revenue_growth = ((monthly_revenue - last_month_revenue) / last_month_revenue * 100)
    elif monthly_revenue > 0:
        revenue_growth = 100  # First time revenue
    
    # Subscription distribution - FIXED plan names
    monthly_plan = db.query(Institute).filter(
        Institute.subscription_plan == "monthly",  
        Institute.payment_status == "PAID"  
    ).count()
    
    annual_plan = db.query(Institute).filter(
        Institute.subscription_plan == "annual",  
        Institute.payment_status == "PAID"
    ).count()
    
    active_subscriptions = monthly_plan + annual_plan
    
    # Pending payments - only count institutes with PENDING status
    pending_payments = db.query(Institute).filter(
        Institute.payment_status == "PENDING"
    ).count()
    
    # Calculate actual pending amount based on subscription plan
    pending_amount_query = db.query(
        func.sum(
            case(
                (Institute.subscription_plan == "Monthly", 5000),
                (Institute.subscription_plan == "Annual", 50000),
                else_=0
            )
        )
    ).filter(
        Institute.payment_status == "PENDING"
    ).scalar() or 0
    
    pending_amount = pending_amount_query
    
    # AI usage - get actual recognition count from your AI logs
    # Assuming you have an AIRecognitionLog table
        # Fallback placeholder
    ai_usage = total_users * 50
    
    # AI accuracy - placeholder, implement based on your actual accuracy tracking
    ai_accuracy = 96.7  # You should calculate this from actual recognition logs
    
    # Institute growth (last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    new_institutes = db.query(Institute).filter(
        Institute.created_at >= thirty_days_ago
    ).count()
    
    institute_growth = 0
    if total_institutes > 0:
        institute_growth = (new_institutes / total_institutes * 100)
    
    # Calculate revenue growth for institutes
    prev_month_institutes = db.query(Institute).filter(
        Institute.created_at >= (thirty_days_ago - timedelta(days=30)),
        Institute.created_at < thirty_days_ago
    ).count()
    
    institute_growth_value = 0
    if prev_month_institutes > 0:
        institute_growth_value = ((new_institutes - prev_month_institutes) / prev_month_institutes * 100)
    elif new_institutes > 0:
        institute_growth_value = 100
    
    return {
        "total_institutes": total_institutes,
        "active_institutes": active_institutes,
        "inactive_institutes": inactive_institutes,
        "total_users": total_users,
        "admin_count": admin_count,
        "faculty_count": faculty_count,
        "student_count": student_count,
        "monthly_revenue": monthly_revenue,
        "revenue_growth": round(revenue_growth, 1),
        "monthly_plan": monthly_plan,  # Changed from "basic_plan"
        "annual_plan": annual_plan,    # Changed from "premium_plan"
        "active_subscriptions": active_subscriptions,
        "pending_payments": pending_payments,
        "pending_amount": pending_amount,
        "ai_usage": ai_usage,
        "ai_accuracy": round(ai_accuracy, 1),
        "institute_growth": round(institute_growth_value, 1)
    }

@router.get("/monthly-registrations")
async def get_monthly_registrations(
    months: int = Query(12, ge=1, le=36),
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get monthly institute registrations"""
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months*30)
    
    # Generate all months in range
    months_list = []
    current = start_date.replace(day=1)
    while current <= end_date:
        months_list.append(current.strftime("%b %Y"))
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    # Query registrations per month
    registrations = {}
    for month in months_list:
        registrations[month] = 0
    
    # Actual query (simplified - you might need to adjust based on your DB)
    results = db.query(
        func.date_trunc('month', Institute.created_at).label('month'),
        func.count(Institute.institute_id).label('count')
    ).filter(
        Institute.created_at >= start_date
    ).group_by(
        func.date_trunc('month', Institute.created_at)
    ).order_by('month').all()
    
    for result in results:
        month_key = result.month.strftime("%b %Y")
        if month_key in registrations:
            registrations[month_key] = result.count
    
    return {
        "labels": list(registrations.keys()),
        "values": list(registrations.values())
    }

@router.get("/subscription-distribution")
async def get_subscription_distribution(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get subscription plan distribution"""
    
    # Count institutes by subscription plan (only paid ones)
    monthly_count = db.query(Institute).filter(
        Institute.subscription_plan == "monthly",
        Institute.payment_status == "PAID"
    ).count()
    
    annual_count = db.query(Institute).filter(
        Institute.subscription_plan == "annual",
        Institute.payment_status == "PAID"
    ).count()
    
    # Count pending/inactive
    pending_count = db.query(Institute).filter(
        Institute.payment_status == "PENDING"
    ).count()
    
    # Free trial (if you have this)
    free_count = db.query(Institute).filter(
        Institute.subscription_plan == "Free"
    ).count() if hasattr(Institute, 'Free') else 0
    
    return {
        "labels": ["Monthly", "Annual", "Pending", "Free"],
        "values": [monthly_count, annual_count, pending_count, free_count]
    }

@router.get("/institute-usage")
async def get_institute_usage(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get institute-wise AI usage (simplified)"""
    
    # Get top 10 institutes by student count (as proxy for usage)
    institutes = db.query(Institute).order_by(
        desc(Institute.student_count)
    ).limit(10).all()
    
    return {
        "labels": [inst.institute_name[:20] + "..." if len(inst.institute_name) > 20 else inst.institute_name 
                   for inst in institutes],
        "values": [inst.student_count * 10 for inst in institutes]  # Placeholder
    }


@router.get("/institutes")
async def get_all_institutes(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get all institutes with details"""
    
    institutes = db.query(Institute).order_by(desc(Institute.created_at)).all()
    
    return [
        {
            "institute_id": inst.institute_id,
            "institute_name": inst.institute_name,
            "email": inst.email,
            "phone": inst.phone,
            "institute_type": inst.institute_type,
            "student_count": inst.student_count,
            "subscription_plan": inst.subscription_plan,
            "payment_status": inst.payment_status,
            "is_active": inst.payment_status == "PAID",
            "created_at": inst.created_at.isoformat() if inst.created_at else None,
            "contact_person": inst.contact_person
        }
        for inst in institutes
    ]

@router.get("/users")
async def get_all_users(
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users with institute details"""
    
    users = db.query(User).join(
        Institute, User.institute_id == Institute.institute_id, isouter=True
    ).order_by(desc(User.created_at)).all()
    
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "institute_id": user.institute_id,
            "institute_name": user.institute.institute_name if user.institute else None,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.token_expiry.isoformat() if user.token_expiry else None
        }
        for user in users
    ]

@router.post("/institutes/{institute_id}/toggle-status")
async def toggle_institute_status(
    institute_id: str,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Activate/Deactivate an institute"""
    
    institute = db.query(Institute).filter(Institute.institute_id == institute_id).first()
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")
    
    # Toggle payment status
    if institute.payment_status == "PAID":
        institute.payment_status = "SUSPENDED"
    else:
        institute.payment_status = "PAID"
    
    db.commit()
    
    return {
        "message": f"Institute {'activated' if institute.payment_status == 'PAID' else 'deactivated'}",
        "status": institute.payment_status
    }

@router.post("/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: int,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Activate/Deactivate a user"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    user.is_active = not user.is_active
    db.commit()
    
    return {
        "message": f"User {'activated' if user.is_active else 'deactivated'}",
        "is_active": user.is_active
    }

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Reset user password to default"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate temporary password
    import random
    import string
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    # Hash and update password (you'll need to import hash_password)
    from utils.hashing import hash_password
    user.password_hash = hash_password(temp_password)
    db.commit()
    
    # In production, send email with temp password
    return {
        "message": "Password reset successful",
        "temp_password": temp_password,  # Only for demo - don't return in production
        "email": user.email
    }

@router.get("/export/institutes")
async def export_institutes(
    format: str = Query("excel", regex="^(excel|csv|pdf)$"),
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """Export institutes data"""
    
    institutes = db.query(Institute).all()
    
    # Convert to DataFrame
    data = []
    for inst in institutes:
        data.append({
            "Institute ID": inst.institute_id,
            "Name": inst.institute_name,
            "Email": inst.email,
            "Phone": inst.phone,
            "Type": inst.institute_type,
            "Students": inst.student_count,
            "Subscription": inst.subscription_plan,
            "Status": inst.payment_status,
            "Created At": inst.created_at,
            "Contact Person": inst.contact_person
        })
    
    df = pd.DataFrame(data)
    
    if format == "excel":
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Institutes')
        output.seek(0)
        
        return {
            "filename": f"institutes_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "data": output.getvalue().hex()
        }
    
    elif format == "csv":
        csv_data = df.to_csv(index=False)
        return {
            "filename": f"institutes_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            "content_type": "text/csv",
            "data": csv_data
        }
    
    # PDF would require additional libraries like ReportLab
    return {"message": "Export format not implemented yet"}