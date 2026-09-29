from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, vehicles, customers, bookings, payments, returns, users, reports, notifications

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VRMS API",
    description="Vehicle Rental Management System backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your app's origin(s) before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(customers.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(returns.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
