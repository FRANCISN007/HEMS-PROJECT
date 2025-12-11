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

    # 🔥 NEW FIELD
    store_item_id: Optional[int] = None



class MealDisplay(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    available: bool
    category_id: int
    location_id: int

    # 🔥 NEW FIELD
    store_item_id: Optional[int]

    class Config:
        from_attributes = True


#Order
class MealOrderItemCreate(BaseModel):
    store_item_id: int  # previously meal_id
    quantity: int
    price_per_unit: float   # 👈 NEW

class MealOrderCreate(BaseModel):
    location_id: Optional[int] = None
    order_type: str  # "Room" or "POS"
    room_number: Optional[str] = None
    guest_name: str
    items: List[MealOrderItemCreate]
    status: Optional[str] = "open"
    
    class Config:
        from_attributes = True



class MealOrderItemDisplay(BaseModel):
    store_item_id: int
    item_name: str
    quantity: int
    price_per_unit: float
    total_price: float

    @staticmethod
    def from_orm(item):
        return MealOrderItemDisplay(
            store_item_id=item.store_item_id,
            item_name=item.item_name,
            quantity=item.quantity,
            price_per_unit=item.price_per_unit,
            total_price=item.total_price,
        )



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
    

class RestaurantMealItem(BaseModel):
    id: int
    name: str
    price: float

    class Config:
        from_attributes = True
