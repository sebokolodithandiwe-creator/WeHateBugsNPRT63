from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import hash_password, verify_password, create_access_token
from app.audit import log_action
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Public self-registration creates a Clerk account only.
    Administrator/Manager accounts must be created or promoted by an Administrator.
    """
    if payload.role != models.UserRole.clerk:
        raise HTTPException(
            status_code=403,
            detail="Public registration can only create Clerk accounts. An Administrator must create privileged staff accounts.",
        )
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
        role=models.UserRole.clerk,
        employee_id=payload.employee_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    user.last_login = datetime.utcnow()
    log_action(db, user.id, "LOGIN", "users", f"{user.username} logged in")
    db.commit()

    token = create_access_token(data={"sub": user.id, "role": user.role.value})
    return schemas.Token(access_token=token, role=user.role, full_name=user.full_name)


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(
    current_user: models.User = Depends(get_current_user)
):
    return current_user
