import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    clerk = "clerk"


class VehicleStatus(str, enum.Enum):
    available = "available"
    booked = "booked"
    rented = "rented"
    maintenance = "maintenance"


class BookingStatus(str, enum.Enum):
    confirmed = "confirmed"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    eft = "eft"


class VehicleCondition(str, enum.Enum):
    good = "good"
    fair = "fair"
    poor = "poor"


class User(Base):
    __tablename__ = "users"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("USR"))
    full_name = Column(String(120), nullable=False)
    username = Column(String(60), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.clerk)
    employee_id = Column(String(40), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("VEH"))
    make = Column(String(60), nullable=False)
    model = Column(String(60), nullable=False)
    year = Column(Integer, nullable=False)
    plate = Column(String(20), unique=True, nullable=False, index=True)
    vehicle_type = Column(String(30), nullable=False)   # Sedan, SUV, Truck, Hatch...
    fuel_type = Column(String(30), nullable=False)       # Petrol, Diesel, Hybrid
    seats = Column(Integer, nullable=False)
    color = Column(String(30), nullable=True)
    mileage = Column(Integer, default=0)
    last_service_mileage = Column(Integer, default=0)
    status = Column(Enum(VehicleStatus), default=VehicleStatus.available)
    daily_rate = Column(Float, nullable=False)
    weekly_rate = Column(Float, nullable=True)
    monthly_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("Booking", back_populates="vehicle")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("CUS"))
    full_name = Column(String(120), nullable=False)
    id_number = Column(String(30), nullable=True)
    drivers_license = Column(String(30), nullable=True)
    phone = Column(String(30), nullable=False)
    email = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("Booking", back_populates="customer")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("BK"))
    customer_id = Column(String(20), ForeignKey("customers.id"), nullable=False)
    vehicle_id = Column(String(20), ForeignKey("vehicles.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    total_days = Column(Integer, nullable=False)
    base_amount = Column(Float, nullable=False)
    vat_amount = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.confirmed)
    created_by = Column(String(20), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="bookings")
    vehicle = relationship("Vehicle", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking")
    return_record = relationship("VehicleReturn", back_populates="booking", uselist=False)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("TXN"))
    booking_id = Column(String(20), ForeignKey("bookings.id"), nullable=False)
    amount = Column(Float, nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    deposit_amount = Column(Float, default=0)
    deposit_reference = Column(String(60), nullable=True)
    processed_by = Column(String(20), ForeignKey("users.id"), nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("Booking", back_populates="payments")


class VehicleReturn(Base):
    __tablename__ = "returns"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("RTN"))
    booking_id = Column(String(20), ForeignKey("bookings.id"), nullable=False, unique=True)
    actual_return_date = Column(DateTime, default=datetime.utcnow)
    ending_odometer = Column(Integer, nullable=False)
    ending_fuel_level = Column(Integer, nullable=False)  # percent
    condition = Column(Enum(VehicleCondition), default=VehicleCondition.good)
    damage_notes = Column(Text, nullable=True)
    days_overdue = Column(Integer, default=0)
    late_fee = Column(Float, default=0)
    fuel_penalty = Column(Float, default=0)
    total_penalty = Column(Float, default=0)
    km_driven = Column(Integer, default=0)
    processed_by = Column(String(20), ForeignKey("users.id"), nullable=False)

    booking = relationship("Booking", back_populates="return_record")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String(20), primary_key=True, default=lambda: gen_id("LOG"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String(20), ForeignKey("users.id"), nullable=True)
    action = Column(String(40), nullable=False)         # e.g. "CREATE", "UPDATE", "DELETE", "LOGIN"
    affected_table = Column(String(60), nullable=False)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
