# restpayment/schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from typing import List



class PaymentCreate(BaseModel):
    amount: float
    payment_mode: str
    bank: str | None = None   # ✅ added
    paid_by: str | None = None



class PaymentDisplay(BaseModel):
    id: int
    amount_paid: float
    payment_mode: str
    bank: Optional[str]     # ✅ added
    paid_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True



class RestaurantSalePaymentDisplay(BaseModel):
    id: int
    sale_id: int
    amount_paid: float
    payment_mode: str  # e.g., "cash", "POS", "transfer"
    bank: Optional[str]     # ✅ added
    paid_by: Optional[str]
    is_void: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdatePaymentSchema(BaseModel):
    amount_paid: Optional[float] = None
    payment_mode: Optional[str] = None
    paid_by: Optional[str] = None
    bank: Optional[str] = None   # <-- must be Optional

# restpayment/schemas.py


class RestaurantSaleDisplay(BaseModel):
    id: int
    order_id: int
    total_amount: float
    served_by: Optional[str]
    created_at: datetime
    payments: List[RestaurantSalePaymentDisplay] = []

    class Config:
        from_attributes = True

class RestaurantSaleWithPaymentsDisplay(BaseModel):
    id: int
    total_amount: float
    status: Optional[str]
    created_at: datetime
    payments: List[RestaurantSalePaymentDisplay]
    #balance: float  # ✅ Add this

    class Config:
        from_attributes = True


