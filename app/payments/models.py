from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import pytz
from app.bank import models as bank_models  # ✅ import bank models
from app.core.mixins import BusinessMixin


def get_local_time():
    lagos_tz = pytz.timezone("Africa/Lagos")
    return datetime.now(lagos_tz)


class Payment(Base, BusinessMixin):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    

    booking_id = Column(Integer, ForeignKey('bookings.id', ondelete="CASCADE"), nullable=False, index=True)
    room_number = Column(String, index=True)
    guest_name = Column(String, index=True)

    amount_paid = Column(Float, nullable=False, default=0.0)
    discount_allowed = Column(Float, default=0.0)
    balance_due = Column(Float, default=0.0)

    payment_method = Column(String, nullable=False)
    payment_date = Column(DateTime(timezone=True), default=get_local_time)
    void_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")

    created_by = Column(String, nullable=False)

    # ✅ Bank Foreign Key
    bank_id = Column(Integer, ForeignKey("banks.id", ondelete="RESTRICT"), nullable=True)
    bank = relationship("Bank", back_populates="payments")

    # Booking relationship
    booking = relationship("Booking", back_populates="payments")
