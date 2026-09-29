from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles
from app.auth import hash_password
from app.models import UserRole
from app.audit import log_action

router = APIRouter(prefix="/users", tags=["users (admin)"])

@router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(400, "That username is already taken.")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "That email is already registered.")
    if payload.employee_id and db.query(models.User).filter(models.User.employee_id == payload.employee_id).first():
        raise HTTPException(400, "That employee ID is already registered.")

    user = models.User(
        full_name=payload.full_name.strip(),
        username=payload.username.strip(),
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        employee_id=payload.employee_id,
    )
    db.add(user)
    db.flush()
    log_action(db, current_user.id, "CREATE", "users", f"{user.username} ({user.role.value})")
    db.commit()
    db.refresh(user)
    return user



@router.get("", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    return db.query(models.User).order_by(models.User.full_name).all()


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(400, "You cannot deactivate your own account.")
    data = payload.dict(exclude_unset=True)
    if user.role == UserRole.admin and (
        data.get("is_active") is False or data.get("role") in {UserRole.manager, UserRole.clerk}
    ):
        active_admins = db.query(models.User).filter(
            models.User.role == UserRole.admin,
            models.User.is_active.is_(True),
        ).count()
        if active_admins <= 1:
            raise HTTPException(400, "The system must retain at least one active Administrator.")
    changed_fields = [k for k in data.keys() if k != "password"]
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
        changed_fields.append("password")
    for field, value in data.items():
        setattr(user, field, value)
    log_action(db, current_user.id, "UPDATE", "users", f"{user.username}: updated {changed_fields}")
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot delete your own account.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")

    username, role = user.username, user.role.value

    # Audit log entries reference this user by ID. Deleting the user while
    # those references still point at them would violate the foreign key
    # constraint, so we detach the old entries (keeping the history, just
    # without a live link) before removing the user.
    db.query(models.AuditLog).filter(models.AuditLog.user_id == user_id).update({"user_id": None})
    db.delete(user)
    log_action(db, current_user.id, "DELETE", "users", f"{username} ({role})")
    db.commit()


@router.get("/audit-log/all", response_model=List[schemas.AuditLogOut])
def get_audit_log(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(UserRole.admin)),
):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(200).all()
