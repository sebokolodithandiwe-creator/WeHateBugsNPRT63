from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles
from app.models import UserRole
from app.audit import log_action

LATE_FEE_PER_DAY = 150.0
FUEL_PENALTY_PER_PERCENT = 6.0
STAFF_ROLES = (UserRole.admin, UserRole.manager, UserRole.clerk)

router = APIRouter(prefix="/returns", tags=["returns"])


@router.post("", response_model=schemas.ReturnOut, status_code=201)
def process_return(
    payload: schemas.ReturnCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    if booking.return_record:
        raise HTTPException(400, "This booking has already been returned.")
    if booking.status != models.BookingStatus.active:
        raise HTTPException(400, "Only an active rental can be returned.")

    vehicle = booking.vehicle
    return_date = payload.actual_return_date or datetime.utcnow()
    if return_date.tzinfo is not None:
        return_date = return_date.replace(tzinfo=None)
    if return_date < booking.start_date:
        raise HTTPException(400, "Return date cannot be before the rental start date.")
    if payload.ending_odometer < vehicle.mileage:
        raise HTTPException(400, "Ending odometer cannot be lower than the vehicle's recorded mileage.")

    days_overdue = max(0, (return_date.date() - booking.end_date.date()).days)
    late_fee = round(days_overdue * LATE_FEE_PER_DAY, 2)

    # The current schema does not store checkout fuel. Until that is added,
    # retain the existing 100% baseline rather than silently inventing a value.
    fuel_shortfall = max(0, 100 - payload.ending_fuel_level)
    fuel_penalty = round(fuel_shortfall * FUEL_PENALTY_PER_PERCENT, 2)
    total_penalty = round(late_fee + fuel_penalty, 2)
    km_driven = payload.ending_odometer - vehicle.mileage

    record = models.VehicleReturn(
        booking_id=booking.id,
        actual_return_date=return_date,
        ending_odometer=payload.ending_odometer,
        ending_fuel_level=payload.ending_fuel_level,
        condition=payload.condition,
        damage_notes=payload.damage_notes,
        days_overdue=days_overdue,
        late_fee=late_fee,
        fuel_penalty=fuel_penalty,
        total_penalty=total_penalty,
        km_driven=km_driven,
        processed_by=current_user.id,
    )

    vehicle.mileage = payload.ending_odometer
    vehicle.status = (
        models.VehicleStatus.maintenance
        if payload.condition == models.VehicleCondition.poor
        else models.VehicleStatus.available
    )
    booking.status = models.BookingStatus.completed

    db.add(record)
    db.flush()
    log_action(db, current_user.id, "RETURN", "returns", f"Return {record.id} for booking {booking.id}; penalty R{total_penalty:.2f}")
    db.commit()
    db.refresh(record)
    return record
