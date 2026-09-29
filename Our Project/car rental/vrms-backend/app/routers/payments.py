from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles
from app.models import UserRole
from app.audit import log_action

router = APIRouter(prefix="/payments", tags=["payments"])
STAFF_ROLES = (UserRole.admin, UserRole.manager, UserRole.clerk)


@router.post("", response_model=schemas.PaymentOut, status_code=201)
def process_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    booking = db.query(models.Booking).filter(models.Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found.")
    if booking.status == models.BookingStatus.cancelled:
        raise HTTPException(400, "Cannot process a payment for a cancelled booking.")

    paid = sum(p.amount for p in booking.payments)
    outstanding = max(0.0, round(booking.total_amount - paid, 2))
    if payload.amount > outstanding + 0.01:
        raise HTTPException(400, f"Payment exceeds the outstanding booking balance of R {outstanding:.2f}.")
    if payload.method == models.PaymentMethod.eft and not payload.deposit_reference:
        raise HTTPException(400, "An EFT reference is required for EFT payments.")
    if payload.deposit_amount > payload.amount:
        raise HTTPException(400, "Deposit amount cannot be greater than the payment amount.")

    payment = models.Payment(
        booking_id=booking.id,
        amount=round(payload.amount, 2),
        method=payload.method,
        deposit_amount=round(payload.deposit_amount, 2),
        deposit_reference=payload.deposit_reference,
        processed_by=current_user.id,
    )
    db.add(payment)
    db.flush()
    log_action(db, current_user.id, "PAYMENT", "payments", f"{payment.id}: R{payment.amount:.2f} for booking {booking.id}")
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/booking/{booking_id}", response_model=List[schemas.PaymentOut])
def get_payments_for_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    if not db.query(models.Booking).filter(models.Booking.id == booking_id).first():
        raise HTTPException(404, "Booking not found.")
    return db.query(models.Payment).filter(models.Payment.booking_id == booking_id).order_by(models.Payment.processed_at.desc()).all()
