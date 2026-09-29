from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.deps import get_current_user, require_roles
from app.models import UserRole

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/revenue")
def revenue_report(
    start_date: Optional[datetime] = Query(None, description="Defaults to 30 days ago"),
    end_date: Optional[datetime] = Query(None, description="Defaults to now"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    """Total revenue and a per-day breakdown, for a date range."""
    end = end_date or datetime.utcnow()
    start = start_date or (end - timedelta(days=30))

    payments = (
        db.query(models.Payment)
        .filter(models.Payment.processed_at >= start, models.Payment.processed_at <= end)
        .all()
    )

    total_revenue = sum(p.amount for p in payments)
    by_method: dict = {}
    by_day: dict = {}
    for p in payments:
        by_method[p.method.value] = by_method.get(p.method.value, 0) + p.amount
        day_key = p.processed_at.strftime("%Y-%m-%d")
        by_day[day_key] = by_day.get(day_key, 0) + p.amount

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_revenue": round(total_revenue, 2),
        "transaction_count": len(payments),
        "by_method": {k: round(v, 2) for k, v in by_method.items()},
        "by_day": [{"date": d, "amount": round(a, 2)} for d, a in sorted(by_day.items())],
    }


@router.get("/fleet-utilization")
def fleet_utilization_report(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    """Current fleet status breakdown, plus per-vehicle booking counts and total days rented."""
    vehicles = db.query(models.Vehicle).all()

    status_counts = {s.value: 0 for s in models.VehicleStatus}
    vehicle_rows = []

    for v in vehicles:
        status_counts[v.status.value] += 1
        bookings = db.query(models.Booking).filter(models.Booking.vehicle_id == v.id).all()
        counted = [b for b in bookings if b.status != models.BookingStatus.cancelled]
        total_days_rented = sum(b.total_days for b in counted)
        total_revenue = sum(b.total_amount for b in counted)
        vehicle_rows.append({
            "vehicle_id": v.id,
            "make": v.make,
            "model": v.model,
            "plate": v.plate,
            "status": v.status.value,
            "total_bookings": len(counted),
            "total_days_rented": total_days_rented,
            "total_revenue": round(total_revenue, 2),
        })

    vehicle_rows.sort(key=lambda r: r["total_revenue"], reverse=True)

    return {
        "fleet_size": len(vehicles),
        "status_breakdown": status_counts,
        "vehicles": vehicle_rows,
    }


@router.get("/customers/{customer_id}")
def customer_history_report(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    """A single customer's full rental history and lifetime spend."""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.customer_id == customer_id)
        .order_by(models.Booking.created_at.desc())
        .all()
    )
    total_spent = sum(b.total_amount for b in bookings if b.status != models.BookingStatus.cancelled)

    return {
        "customer": {
            "id": customer.id,
            "full_name": customer.full_name,
            "phone": customer.phone,
            "email": customer.email,
        },
        "total_bookings": len(bookings),
        "total_spent": round(total_spent, 2),
        "bookings": [
            {
                "id": b.id,
                "vehicle_id": b.vehicle_id,
                "start_date": b.start_date.isoformat(),
                "end_date": b.end_date.isoformat(),
                "status": b.status.value,
                "total_amount": b.total_amount,
            }
            for b in bookings
        ],
    }
