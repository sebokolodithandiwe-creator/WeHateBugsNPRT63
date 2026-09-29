from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles
from app.models import UserRole
from app.contracts import generate_contract_pdf
from app.audit import log_action

VAT_RATE = 0.15
STAFF_ROLES = (UserRole.admin, UserRole.manager, UserRole.clerk)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _ensure_naive(value: datetime) -> datetime:
    return value.replace(tzinfo=None) if value.tzinfo else value


def _overlap_exists(db: Session, vehicle_id: str, start: datetime, end: datetime, exclude_id: str | None = None):
    query = db.query(models.Booking).filter(
        models.Booking.vehicle_id == vehicle_id,
        models.Booking.status.in_([
            models.BookingStatus.confirmed,
            models.BookingStatus.active,
        ]),
        models.Booking.start_date < end,
        models.Booking.end_date > start,
    )
    if exclude_id:
        query = query.filter(models.Booking.id != exclude_id)
    return query.first()


@router.get("", response_model=List[schemas.BookingOut])
def list_bookings(
    customer_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    status: Optional[models.BookingStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    query = db.query(models.Booking)
    if customer_id:
        query = query.filter(models.Booking.customer_id == customer_id)
    if vehicle_id:
        query = query.filter(models.Booking.vehicle_id == vehicle_id)
    if status:
        query = query.filter(models.Booking.status == status)
    return query.order_by(models.Booking.created_at.desc()).all()


@router.get("/{booking_id}", response_model=schemas.BookingOut)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    return booking


@router.post("", response_model=schemas.BookingOut, status_code=201)
def create_booking(
    payload: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    start = _ensure_naive(payload.start_date)
    end = _ensure_naive(payload.end_date)
    if start < datetime.utcnow():
        raise HTTPException(400, "Booking start date cannot be in the past.")
    if end <= start:
        raise HTTPException(400, "End date must be after the start date.")

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found.")
    if vehicle.status in (models.VehicleStatus.rented, models.VehicleStatus.maintenance):
        raise HTTPException(400, f"Vehicle is currently {vehicle.status.value} and cannot be booked.")
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    if _overlap_exists(db, vehicle.id, start, end):
        raise HTTPException(409, "This vehicle is already booked for part of the selected period.")

    total_days = max(1, (end - start).days)
    base_amount = round(total_days * vehicle.daily_rate, 2)
    vat_amount = round(base_amount * VAT_RATE, 2)
    total_amount = round(base_amount + vat_amount, 2)

    booking = models.Booking(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        start_date=start,
        end_date=end,
        total_days=total_days,
        base_amount=base_amount,
        vat_amount=vat_amount,
        total_amount=total_amount,
        created_by=current_user.id,
    )
    vehicle.status = models.VehicleStatus.booked
    db.add(booking)
    db.flush()
    log_action(db, current_user.id, "CREATE", "bookings", f"Booking {booking.id} for vehicle {vehicle.id}")
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/activate", response_model=schemas.BookingOut)
def activate_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    if booking.status != models.BookingStatus.confirmed:
        raise HTTPException(400, f"Only confirmed bookings can be activated. Current status: {booking.status.value}.")
    booking.status = models.BookingStatus.active
    booking.vehicle.status = models.VehicleStatus.rented
    log_action(db, current_user.id, "ACTIVATE", "bookings", f"Booking {booking.id} activated")
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    if booking.status in (models.BookingStatus.completed, models.BookingStatus.cancelled):
        raise HTTPException(400, f"Booking is already {booking.status.value}.")
    if booking.status == models.BookingStatus.active:
        raise HTTPException(400, "An active rental must be returned rather than cancelled.")
    booking.status = models.BookingStatus.cancelled
    booking.vehicle.status = models.VehicleStatus.available
    log_action(db, current_user.id, "CANCEL", "bookings", f"Booking {booking.id} cancelled")
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}/contract")
def get_booking_contract(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    pdf_bytes = generate_contract_pdf(booking)
    filename = f"rental-agreement-{booking.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
