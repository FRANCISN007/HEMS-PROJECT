from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import pytz
from app.core.mixins import BusinessMixin

def get_local_time():
    """Return current time in Africa/Lagos timezone"""
    lagos_tz = pytz.timezone("Africa/Lagos")
    return datetime.now(lagos_tz)


class RestaurantSalePayment(Base, BusinessMixin):
    __tablename__ = "restaurant_sale_payments"

    id = Column(Integer, primary_key=True, index=True)

   

    sale_id = Column(Integer, ForeignKey("restaurant_sales.id", ondelete="CASCADE"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False)  # "cash", "POS", "transfer"
    bank = Column(String, nullable=True)  # Optional bank info
    paid_by = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_local_time)
    updated_at = Column(DateTime(timezone=True), default=get_local_time, onupdate=get_local_time)
    is_void = Column(Boolean, default=False)

    # Relationships
    sale = relationship("RestaurantSale", back_populates="payments")
