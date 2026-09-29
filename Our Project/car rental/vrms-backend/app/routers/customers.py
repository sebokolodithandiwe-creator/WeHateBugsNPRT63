from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user, require_roles
from app.models import UserRole
from app.audit import log_action

router = APIRouter(prefix="/customers", tags=["customers"])
STAFF_ROLES = (UserRole.admin, UserRole.manager, UserRole.clerk)


@router.get("", response_model=List[schemas.CustomerOut])
def search_customers(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    query = db.query(models.Customer)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (models.Customer.full_name.ilike(like))
            | (models.Customer.phone.ilike(like))
            | (models.Customer.id_number.ilike(like))
            | (models.Customer.drivers_license.ilike(like))
        )
    return query.order_by(models.Customer.full_name).all()


@router.post("", response_model=schemas.CustomerOut, status_code=201)
def create_customer(
    payload: schemas.CustomerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    if payload.id_number and db.query(models.Customer).filter(models.Customer.id_number == payload.id_number).first():
        raise HTTPException(400, "A customer with that ID number already exists.")
    if payload.drivers_license and db.query(models.Customer).filter(models.Customer.drivers_license == payload.drivers_license).first():
        raise HTTPException(400, "A customer with that driver's licence already exists.")

    customer = models.Customer(**payload.dict())
    db.add(customer)
    db.flush()
    log_action(db, current_user.id, "CREATE", "customers", f"Customer {customer.id} - {customer.full_name}")
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")
    return customer


@router.patch("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(
    customer_id: str,
    payload: schemas.CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")
    data = payload.dict(exclude_unset=True)
    if "id_number" in data and data["id_number"]:
        duplicate = db.query(models.Customer).filter(
            models.Customer.id_number == data["id_number"],
            models.Customer.id != customer_id
        ).first()
        if duplicate:
            raise HTTPException(400, "A customer with that ID number already exists.")
    if "drivers_license" in data and data["drivers_license"]:
        duplicate = db.query(models.Customer).filter(
            models.Customer.drivers_license == data["drivers_license"],
            models.Customer.id != customer_id
        ).first()
        if duplicate:
            raise HTTPException(400, "A customer with that driver's licence already exists.")
    for field, value in data.items():
        setattr(customer, field, value)
    log_action(db, current_user.id, "UPDATE", "customers", f"{customer.id}: updated {list(data.keys())}")
    db.commit()
    db.refresh(customer)
    return customer
