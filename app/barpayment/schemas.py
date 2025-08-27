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
    sale_amount: float        # 👈 new field for total sale amount
    amount_paid: float        # cumulative paid
    balance_due: float        # remaining balance
    payment_method: Literal["cash", "transfer", "pos"]
    date_paid: datetime
    status: str
    created_by: str           # 👈 include creator for clarity
    note: Optional[str] = None

    class Config:
        from_attributes = True
        



class BarPaymentUpdate(BaseModel):
    amount_paid: Optional[float] = None
    payment_method: Optional[Literal["cash", "transfer", "pos"]] = None
    note: Optional[str] = None



class BarPaymentVoid(BaseModel):
    void: bool  # If True, will void


class BarPaymentOutstanding(BaseModel):
    id: int
    bar_sale_id: int
    amount_paid: float
    payment_method: Literal["cash", "transfer", "pos"]
    note: Optional[str] = None
    date_paid: datetime
    status: str
    total_sale: float
    balance_due: float

    class Config:
        from_attributes = True


class BarOutstandingDisplay(BaseModel):
    bar_sale_id: int
    sale_amount: float
    amount_paid: float
    balance_due: float
    status: str

    class Config:
        from_attributes = True


class BarOutstandingSummary(BaseModel):
    total_entries: int
    total_due: float
    results: list[BarOutstandingDisplay]
