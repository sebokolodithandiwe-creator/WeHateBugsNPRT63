from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.deps import get_current_user, require_roles
from app.models import UserRole
from app.audit import log_action

SERVICE_INTERVAL_KM = 10000
LOW_FUEL_THRESHOLD_PERCENT = 25

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Computes live alerts from real data rather than storing notification rows -
    so this is always accurate to the current state of the fleet, never stale.
    """
    now = datetime.utcnow()

    # --- Overdue returns: active/confirmed bookings past their end date with no return yet ---
    candidate_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.status.in_([models.BookingStatus.confirmed, models.BookingStatus.active]))
        .filter(models.Booking.end_date < now)
        .all()
    )
    overdue_returns = [
        {
            "booking_id": b.id,
            "vehicle_id": b.vehicle_id,
            "vehicle": f"{b.vehicle.make} {b.vehicle.model} ({b.vehicle.plate})",
            "customer": b.customer.full_name,
            "end_date": b.end_date.isoformat(),
            "days_overdue": (now - b.end_date).days,
        }
        for b in candidate_bookings
        if b.return_record is None
    ]

    # --- Service due: driven too far since the last recorded service ---
    vehicles = db.query(models.Vehicle).all()
    service_due = [
        {
            "vehicle_id": v.id,
            "vehicle": f"{v.make} {v.model} ({v.plate})",
            "mileage": v.mileage,
            "last_service_mileage": v.last_service_mileage,
            "km_since_service": v.mileage - v.last_service_mileage,
        }
        for v in vehicles
        if (v.mileage - v.last_service_mileage) >= SERVICE_INTERVAL_KM
    ]

    # --- Low fuel: available vehicles whose most recent return recorded low fuel ---
    low_fuel = []
    for v in vehicles:
        if v.status != models.VehicleStatus.available:
            continue
        latest_return = (
            db.query(models.VehicleReturn)
            .join(models.Booking)
            .filter(models.Booking.vehicle_id == v.id)
            .order_by(models.VehicleReturn.actual_return_date.desc())
            .first()
        )
        if latest_return and latest_return.ending_fuel_level < LOW_FUEL_THRESHOLD_PERCENT:
            low_fuel.append({
                "vehicle_id": v.id,
                "vehicle": f"{v.make} {v.model} ({v.plate})",
                "fuel_level": latest_return.ending_fuel_level,
            })

    # --- Currently in maintenance ---
    in_maintenance = [
        {"vehicle_id": v.id, "vehicle": f"{v.make} {v.model} ({v.plate})"}
        for v in vehicles
        if v.status == models.VehicleStatus.maintenance
    ]

    return {
        "overdue_returns": overdue_returns,
        "service_due": service_due,
        "low_fuel": low_fuel,
        "in_maintenance": in_maintenance,
        "total_count": len(overdue_returns) + len(service_due) + len(low_fuel) + len(in_maintenance),
    }


@router.post("/vehicles/{vehicle_id}/service")
def record_service(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    """Marks a vehicle as freshly serviced at its current mileage, clearing the service-due alert."""
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found.")

    vehicle.last_service_mileage = vehicle.mileage
    log_action(db, current_user.id, "SERVICE", "vehicles", f"{vehicle.plate} serviced at {vehicle.mileage} km")
    db.commit()
    db.refresh(vehicle)
    return {"vehicle_id": vehicle.id, "last_service_mileage": vehicle.last_service_mileage}
