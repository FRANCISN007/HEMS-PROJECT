from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base



class BarPayment(Base):
    __tablename__ = "bar_payments"

    id = Column(Integer, primary_key=True, index=True)
    bar_sale_id = Column(Integer, ForeignKey("bar_sales.id", ondelete="CASCADE"))
    amount_paid = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)  # e.g. "cash", "POS", "transfer"
    date_paid = Column(DateTime, default=datetime.utcnow)
    received_by_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="active")  # <-- NEW
    created_by = Column(String)  # Track user
    note = Column(String, nullable=True)  # <-- NEW

    bar_sale = relationship("BarSale", back_populates="payments")
    received_by_user = relationship("User", lazy="joined")
