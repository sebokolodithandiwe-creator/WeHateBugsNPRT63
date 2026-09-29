from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.models import UserRole, VehicleStatus, BookingStatus, PaymentMethod, VehicleCondition


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    full_name: str


class UserCreate(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: UserRole = UserRole.clerk
    employee_id: Optional[str] = None

    @field_validator("password")
    def validate_password(cls, value):
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value


class UserOut(BaseModel):
    id: str
    full_name: str
    username: str
    email: EmailStr
    role: UserRole
    employee_id: Optional[str]
    is_active: bool
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ---------- Vehicles ----------
class VehicleCreate(BaseModel):
    make: str
    model: str
    year: int
    plate: str
    vehicle_type: str
    fuel_type: str
    seats: int
    color: Optional[str] = None
    mileage: int = 0
    daily_rate: float
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    status: VehicleStatus = VehicleStatus.available


class VehicleUpdate(BaseModel):
    status: Optional[VehicleStatus] = None
    mileage: Optional[int] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None


class VehicleOut(BaseModel):
    id: str
    make: str
    model: str
    year: int
    plate: str
    vehicle_type: str
    fuel_type: str
    seats: int
    color: Optional[str]
    mileage: int
    last_service_mileage: int
    status: VehicleStatus
    daily_rate: float
    weekly_rate: Optional[float]
    monthly_rate: Optional[float]

    class Config:
        from_attributes = True


# ---------- Customers ----------
class CustomerCreate(BaseModel):
    full_name: str
    id_number: Optional[str] = None
    drivers_license: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    id_number: Optional[str] = None
    drivers_license: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class CustomerOut(CustomerCreate):
    id: str

    class Config:
        from_attributes = True


# ---------- Bookings ----------
class BookingCreate(BaseModel):
    customer_id: str
    vehicle_id: str
    start_date: datetime
    end_date: datetime


class BookingOut(BaseModel):
    id: str
    customer_id: str
    vehicle_id: str
    start_date: datetime
    end_date: datetime
    total_days: int
    base_amount: float
    vat_amount: float
    total_amount: float
    status: BookingStatus
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Payments ----------
class PaymentCreate(BaseModel):
    booking_id: str
    amount: float
    method: PaymentMethod
    deposit_amount: float = 0
    deposit_reference: Optional[str] = None

    @field_validator("amount")
    def validate_amount(cls, value):
        if value <= 0:
            raise ValueError("Payment amount must be greater than zero.")
        return value

    @field_validator("deposit_amount")
    def validate_deposit(cls, value):
        if value < 0:
            raise ValueError("Deposit amount cannot be negative.")
        return value


class PaymentOut(BaseModel):
    id: str
    booking_id: str
    amount: float
    method: PaymentMethod
    deposit_amount: float
    deposit_reference: Optional[str]
    processed_by: str
    processed_at: datetime

    class Config:
        from_attributes = True


# ---------- Returns ----------
class ReturnCreate(BaseModel):
    booking_id: str
    ending_odometer: int
    ending_fuel_level: int
    condition: VehicleCondition = VehicleCondition.good
    damage_notes: Optional[str] = None
    actual_return_date: Optional[datetime] = None

    @field_validator("ending_odometer")
    def validate_odometer(cls, value):
        if value < 0:
            raise ValueError("Ending odometer cannot be negative.")
        return value

    @field_validator("ending_fuel_level")
    def validate_fuel(cls, value):
        if not 0 <= value <= 100:
            raise ValueError("Fuel level must be between 0 and 100 percent.")
        return value


class ReturnOut(BaseModel):
    id: str
    booking_id: str
    actual_return_date: datetime
    ending_odometer: int
    ending_fuel_level: int
    condition: VehicleCondition
    damage_notes: Optional[str]
    days_overdue: int
    late_fee: float
    fuel_penalty: float
    total_penalty: float
    km_driven: int
    processed_by: str

    class Config:
        from_attributes = True


# ---------- Audit log ----------
class AuditLogOut(BaseModel):
    id: str
    timestamp: datetime
    user_id: Optional[str]
    action: str
    affected_table: str
    detail: Optional[str]
    ip_address: Optional[str]

    class Config:
        from_attributes = True
