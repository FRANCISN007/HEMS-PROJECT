
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime




class RestaurantSalePayment(Base):
    __tablename__ = "restaurant_sale_payments"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("restaurant_sales.id"))
    amount_paid = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False)  # "cash", "POS", "transfer"
    paid_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_void = Column(Boolean, default=False)

    # Relationships
    sale = relationship("RestaurantSale", back_populates="payments")
