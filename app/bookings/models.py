from sqlalchemy import event
from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, DateTime, Float
from app.database import Base
from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.mixins import BusinessMixin


class Booking(Base, BusinessMixin):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)

    # --- New foreign key to Room.id for SaaS multi-tenant support ---
    room_id = Column(
        Integer,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False
    )

    # keep room_number for display / history
    room_number = Column(String, nullable=False)

    guest_name = Column(String, nullable=False)
    gender = Column(String, nullable=False)

    mode_of_identification = Column(String, nullable=True)
    identification_number = Column(String, nullable=True)

    address = Column(String, nullable=False)
    room_price = Column(Float, nullable=False)

    arrival_date = Column(Date, nullable=False)
    departure_date = Column(Date, nullable=False)

    number_of_days = Column(Integer, nullable=False)

    booking_cost = Column(Float, nullable=True)
    booking_type = Column(String, nullable=False)

    phone_number = Column(String, nullable=True)
    status = Column(String, default="reserved")

    vehicle_no = Column(String, nullable=True)
    attachment = Column(String, nullable=True)
    payment_status = Column(String, default="pending")

    booking_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(ZoneInfo("Africa/Lagos"))
    )

    is_checked_out = Column(Boolean, default=False)
    cancellation_reason = Column(String, nullable=True)
    deleted = Column(Boolean, default=False)
    created_by = Column(String, nullable=False)

    # ----------------------------
    # Relationships
    # ----------------------------
    room = relationship("Room", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking")


# ----------------------------
# Event listener to set number_of_days automatically
# ----------------------------
@event.listens_for(Booking, "before_insert")
@event.listens_for(Booking, "before_update")
def set_number_of_days(mapper, connection, target):
    if target.arrival_date and target.departure_date:
        target.number_of_days = (target.departure_date - target.arrival_date).days
