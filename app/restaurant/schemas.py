# schemas/restaurant.py

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.restpayment.schemas import RestaurantSalePaymentDisplay
from pydantic.config import ConfigDict  # this is the correct import in v2



class RestaurantLocationCreate(BaseModel):
    name: str
    active: bool = True


class RestaurantLocationDisplay(BaseModel):
    id: int
    name: str
    active: bool

    class Config:
        from_attributes = True



# Meal
class MealCategoryCreate(BaseModel):
    name: str


class MealCategoryDisplay(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True



class MealCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    available: bool = True
    category_id: int
    location_id: int


class MealDisplay(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    available: bool
    category_id: int
    location_id: int

    class Config:
        from_attributes = True


#Order
class MealOrderItemCreate(BaseModel):
    meal_id: int
    quantity: int


class MealOrderCreate(BaseModel):
    location_id: Optional[int] = None  # Optional if not selected
    order_type: str  # e.g., "Room" or "POS"
    room_number: Optional[str] = None  # only if order_type == "Room"
    guest_name:str
    items: List[MealOrderItemCreate]
    status: Optional[str] = "open"  # default to pending


    class Config:
        from_attributes = True




class MealOrderItemDisplay(BaseModel):
    meal_id: int
    meal_name: Optional[str] = None
    quantity: int
    price_per_unit: Optional[float] = None
    total_price: Optional[float] = None

    @classmethod
    def from_orm_with_meal(cls, item):
        return cls(
            meal_id=item.meal_id,
            meal_name=item.meal.name if item.meal else None,
            quantity=item.quantity,
            price_per_unit=item.meal.price if item.meal else None,
            total_price=(item.quantity * item.meal.price) if item.meal else None
        )

    class Config:
        from_attributes = True  # Pydantic v2 (equivalent to orm_mode=True)


class MealOrderDisplay(BaseModel):
    id: int
    location_id: Optional[int] = None
    order_type: str
    room_number: Optional[str] = None
    guest_name: str  # ✅ Add this
    status: Optional[str] = None
    created_at: datetime
    items: List[MealOrderItemDisplay]  # already present

    class Config:
        from_attributes = True



class RestaurantSaleDisplay(BaseModel):
    id: int
    order_id: int
    guest_name: Optional[str] = None   # 👈 add this
    location_id: Optional[int] = None   # ✅ add location
    # location_name: Optional[str] = None  # ✅ optional, if you want the name directly
    served_by: str
    total_amount: float
    amount_paid: float
    balance: float
    status: str
    served_at: datetime
    created_at: datetime
    items: List[MealOrderItemDisplay] = []

    model_config = ConfigDict(from_attributes=True)
    