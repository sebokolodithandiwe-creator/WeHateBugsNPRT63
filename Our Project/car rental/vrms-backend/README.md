# VRMS Backend

FastAPI + MySQL backend for the Vehicle Rental Management System.
Tested end-to-end (register → login → book → pay → return) before handoff.

## Stack
- **FastAPI** for the API layer (auto docs at `/docs`)
- **SQLAlchemy** ORM over **MySQL** (via PyMySQL — no compiler/build tools needed, unlike `mysqlclient`)
- **JWT** auth via `python-jose`, passwords hashed with `passlib` (bcrypt)
- Role-based access control: `admin`, `manager`, `clerk`

## Getting started

You need a MySQL server running first (MySQL 8.x or MariaDB 10.x both work —
this was tested against MariaDB 10.11). If you don't have one yet:
- **Windows/Mac, easiest option:** install [XAMPP](https://www.apachefriends.org/) or [MAMP](https://www.mamp.info/) — both bundle MySQL with a GUI to start/stop it.
- **Any OS:** install MySQL Community Server directly from [dev.mysql.com](https://dev.mysql.com/downloads/mysql/), or MariaDB from [mariadb.org](https://mariadb.org/download/).

Once MySQL is running, create the database and user:
```sql
CREATE DATABASE vrms_db;
CREATE USER 'vrms_user'@'localhost' IDENTIFIED BY 'vrms_password';
GRANT ALL PRIVILEGES ON vrms_db.* TO 'vrms_user'@'localhost';
FLUSH PRIVILEGES;
```
(Run this in the MySQL command line, or in phpMyAdmin's SQL tab if you're using XAMPP/MAMP.)

Then set up the Python side:
```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then edit .env if your MySQL user/password/port differ
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/docs` for interactive API docs (Swagger UI) —
every endpoint is listed there with a "try it out" button. Tables are created
automatically the first time the app starts (`Base.metadata.create_all`) —
you don't need to write any CREATE TABLE statements yourself.

### Quick local check without MySQL installed yet
If you just want to poke around before setting up MySQL, you can temporarily set
`DATABASE_URL=sqlite:///./vrms.db` in `.env`. Switch back to the real
`mysql+pymysql://...` URL before you start relying on the data — SQLite here is
only a throwaway sandbox, not a real substitute.

## Known dependency gotcha
`passlib==1.7.4` breaks with `bcrypt>=4.1`. This repo pins `bcrypt==4.0.1` in
`requirements.txt` for that reason — don't bump bcrypt without testing login first.

## Project layout
```
app/
  main.py           FastAPI app + router registration + CORS
  database.py       DB session/engine setup
  models.py         SQLAlchemy models (the schema)
  schemas.py        Pydantic request/response shapes
  auth.py           password hashing + JWT encode/decode
  deps.py           get_current_user, require_roles(...) dependency
  routers/
    auth.py         register, login, /auth/me
    vehicles.py     search + CRUD (create/edit = admin/manager, delete = admin)
    customers.py    search + create
    bookings.py     create (calculates VAT + total), activate, cancel
    payments.py     process payment, list by booking
    returns.py      process return (calculates late fee + fuel penalty)
    users.py        admin-only user management + audit log
```

## Data model (matches the 12-screen design spec)
- **User** — role (admin/manager/clerk), employee_id, active flag, last_login
- **Vehicle** — status enum (available/booked/rented/maintenance), daily/weekly/monthly rates
- **Customer** — name, ID number, driver's license, contact info
- **Booking** — dates, auto-calculated total_days/base_amount/VAT(15%)/total, status
- **Payment** — method (cash/card/eft), deposit fields, linked to booking
- **VehicleReturn** — odometer/fuel/condition on return, auto-calculated penalties
- **AuditLog** — timestamp, user, action, affected table, IP (model in place; write calls to be added as endpoints get audited)

## Business rules already enforced
- A vehicle can only be booked while `status = available`; booking flips it to `booked`
- Booking end date must be after the start date
- VAT is calculated at 15% on the base amount
- Return penalty = R150/day overdue + R6 per % of fuel below full tank
- A vehicle marked "poor" condition on return goes to `maintenance`, not `available`
- Role checks happen server-side via `require_roles(...)` — not just hidden UI, so the mobile app can't bypass them by calling the API directly

## What's not built yet (next steps)
- Alembic migrations (schema currently created via `create_all` — fine for dev, not for production schema changes)
- Audit log *writes* (the table and read endpoint exist; nothing writes to it yet)
- PDF contract/invoice generation
- Email/SMS notifications (service-due, overdue return alerts)
- Refresh tokens (current tokens just expire after `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Rate limiting / production CORS lockdown (currently `allow_origins=["*"]`)

## Auth quick reference
```
POST /auth/register   {full_name, username, email, password, role, employee_id}
POST /auth/login      form data: username, password  -> {access_token, role, full_name}
GET  /auth/me         (Bearer token) -> current user
```
All other endpoints require `Authorization: Bearer <token>`.


## Security and workflow notes

This backend is designed around a staff-operated rental workflow. Public self-registration creates
Clerk accounts only. Administrator accounts can create/manage staff accounts through `/users`.
Manager and Administrator access is enforced server-side.

Booking creation checks date overlap against confirmed/active bookings. Payments validate the
outstanding booking balance and require an EFT reference for EFT payments. Returns are restricted
to active rentals and validate mileage/fuel values. Reports are restricted to Manager/Administrator,
while customer data and rental operations are restricted to authenticated staff.

The frontend should still implement the Phase 4 15-minute inactivity timeout. JWT expiration is
separate from inactivity tracking and should not be treated as the same requirement.

`Base.metadata.create_all()` is retained for the current project setup. For a production deployment,
use proper Alembic migrations instead.
