from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from pydantic.config import ConfigDict  # this is the correct import in v2

# ------------------------------
# GENERIC ITEM SCHEMA FOR KITCHEN (Minimal for Issue Response)
# ------------------------------
class KitchenItemMinimalDisplay(BaseModel):
    id: int
    name: Optional[str] = None  # optional, can be None if name not available

    class Config:
        from_attributes = True


# ------------------------------
# BASIC KITCHEN DISPLAY
# ------------------------------
class KitchenBase(BaseModel):
    name: str

class KitchenCreate(KitchenBase):
    pass

class KitchenDisplaySimple(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True


# ------------------------------
# KITCHEN ISSUE ITEMS
# ------------------------------
class KitchenIssueItemDisplay(BaseModel):
    id: int
    item: KitchenItemMinimalDisplay
    quantity: float

    class Config:
        from_attributes = True


# ------------------------------
# KITCHEN INVENTORY VIEW
# ------------------------------
class KitchenInventoryDisplay(BaseModel):
    id: int
    kitchen: KitchenDisplaySimple
    item: KitchenItemMinimalDisplay
    quantity: float
    last_updated: datetime

    class Config:
        from_attributes = True


# ------------------------------
# KITCHEN STOCK REPORT
# ------------------------------
class KitchenStockDisplay(BaseModel):
    id: int
    kitchen: KitchenDisplaySimple
    item: KitchenItemMinimalDisplay
    total_issued: float
    total_used: float

    class Config:
        from_attributes = True


# ------------------------------
# STORE ISSUE → KITCHEN
# ------------------------------
class IssueToKitchenItem(BaseModel):
    item_id: int
    quantity: float

class IssueToKitchenCreate(BaseModel):
    kitchen_id: int
    issue_items: List[IssueToKitchenItem]
    issue_date: datetime = datetime.utcnow()

class IssueToKitchenItemDisplay(BaseModel):
    item: KitchenItemMinimalDisplay
    quantity: float

    class Config:
        from_attributes = True

class IssueToKitchenDisplay(BaseModel):
    id: int
    kitchen: KitchenDisplaySimple
    issue_items: List[IssueToKitchenItemDisplay]
    issue_date: datetime

    class Config:
        from_attributes = True


class KitchenStockBalance(BaseModel):
    kitchen_id: int
    kitchen_name: str
    item_id: int
    item_name: str
    category_name: Optional[str] = None
    item_type: Optional[str]   # <--- ADD THIS
    unit: Optional[str] = None
    total_issued: float = 0        # what store issued to kitchen
    total_used: float = 0          # what restaurant sold (store_qty_used)
    total_adjusted: float = 0      # if you later add kitchen adjustments
    balance: float = 0             # issued - used - adjusted
    last_unit_price: Optional[float] = None
    balance_total_amount: Optional[float] = None

    class Config:
        from_attributes = True



class KitchenMenuCreate(BaseModel):
    item_id: int
    selling_price: float
    

class KitchenMenuDisplay(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str]
    selling_price: float

    model_config = ConfigDict(from_attributes=True)


class KitchenMenuUpdate(BaseModel):
    selling_price: float

    class Config:
        from_attributes = True
