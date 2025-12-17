from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
from app.bank import models as bank_models  # ✅ import bank models

import pytz
from sqlalchemy.sql import func

def get_local_time():
    lagos_tz = pytz.timezone("Africa/Lagos")
    return datetime.now(lagos_tz)

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey('bookings.id'))
    room_number = Column(String, index=True)
    guest_name = Column(String, index=True)
    amount_paid = Column(Float)
    discount_allowed = Column(Float)
    balance_due = Column(Float, default=0.0)
    payment_method = Column(String)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    void_date = Column(DateTime, nullable=True, default=None)
    status = Column(String, default="pending")
    created_by = Column(String, nullable=False)

    # ✅ Bank Foreign Key
    bank_id = Column(Integer, ForeignKey("banks.id", ondelete="RESTRICT"), nullable=True)
    bank = relationship("Bank", back_populates="payments")

    # Booking relationship
    booking = relationship("Booking", back_populates="payments")
