# app/barpayment/schemas.py

from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime
from typing import Optional


# schemas.py

class BarPaymentCreate(BaseModel):
    bar_sale_id: int
    amount_paid: float
    payment_method: Literal["cash", "transfer", "pos"]
    note: Optional[str] = None


class BarPaymentDisplay(BaseModel):
    id: int
    bar_sale_id: int
    amount_paid: float
    payment_method: str
    note: Optional[str] = None
    date_paid: datetime
    status: str

    class Config:
        from_attributes = True



class BarPaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None

class BarPaymentVoid(BaseModel):
    void: bool  # If True, will void


