from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user, require_roles
from app.models import UserRole
from app.audit import log_action

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=List[schemas.VehicleOut])
def search_vehicles(
    vehicle_type: Optional[str] = None,
    fuel_type: Optional[str] = None,
    min_seats: Optional[int] = None,
    max_daily_rate: Optional[float] = None,
    status: Optional[models.VehicleStatus] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Vehicle)
    if vehicle_type:
        query = query.filter(models.Vehicle.vehicle_type == vehicle_type)
    if fuel_type:
        query = query.filter(models.Vehicle.fuel_type == fuel_type)
    if min_seats:
        query = query.filter(models.Vehicle.seats >= min_seats)
    if max_daily_rate:
        query = query.filter(models.Vehicle.daily_rate <= max_daily_rate)
    if status:
        query = query.filter(models.Vehicle.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(like))
            | (models.Vehicle.model.ilike(like))
            | (models.Vehicle.plate.ilike(like))
        )
    return query.order_by(models.Vehicle.make).all()


@router.get("/{vehicle_id}", response_model=schemas.VehicleOut)
def get_vehicle(vehicle_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found.")
    return vehicle


@router.post("", response_model=schemas.VehicleOut, status_code=201)
def create_vehicle(
    payload: schemas.VehicleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    if db.query(models.Vehicle).filter(models.Vehicle.plate == payload.plate).first():
        raise HTTPException(400, "A vehicle with that plate already exists.")
    vehicle = models.Vehicle(**payload.dict())
    db.add(vehicle)
    log_action(db, current_user.id, "CREATE", "vehicles", f"{vehicle.make} {vehicle.model} ({payload.plate})")
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.patch("/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(
    vehicle_id: str,
    payload: schemas.VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found.")
    changes = payload.dict(exclude_unset=True)
    if "mileage" in changes and changes["mileage"] < vehicle.mileage:
        raise HTTPException(400, "Mileage cannot be reduced.")
    if "status" in changes:
        new_status = changes["status"]
        if vehicle.status == models.VehicleStatus.rented and new_status != models.VehicleStatus.rented:
            raise HTTPException(400, "A rented vehicle must be released through the return process.")
        if vehicle.status == models.VehicleStatus.booked and new_status == models.VehicleStatus.available:
            active_booking = db.query(models.Booking).filter(
                models.Booking.vehicle_id == vehicle.id,
                models.Booking.status == models.BookingStatus.confirmed,
            ).first()
            if active_booking:
                raise HTTPException(400, "This vehicle has a confirmed booking and cannot be manually marked available.")
    for field, value in changes.items():
        setattr(vehicle, field, value)
    log_action(db, current_user.id, "UPDATE", "vehicles", f"{vehicle.id}: {changes}")
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found.")
    log_action(db, current_user.id, "DELETE", "vehicles", f"{vehicle.make} {vehicle.model} ({vehicle.plate})")
    db.delete(vehicle)
    db.commit()
