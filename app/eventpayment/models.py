from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, func, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class EventPayment(Base):
    __tablename__ = "event_payments"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)

    organiser = Column(String, index=True, nullable=False)
    event_amount = Column(Float, nullable=False)
    amount_paid = Column(Float, nullable=False)
    discount_allowed = Column(Float, default=0.0)
    balance_due = Column(Float, default=0.0)
    payment_method = Column(String, nullable=False)

    # 👈 Track bank by name
    bank = Column(String, nullable=True)

    payment_date = Column(DateTime, default=func.now())
    payment_status = Column(String, default="pending")
    created_by = Column(String, nullable=False)

    # Relationships
    event = relationship("Event", back_populates="payments")

    def compute_balance_due(self):
        if self.event:
            self.balance_due = self.event.event_amount - (self.amount_paid + self.discount_allowed)