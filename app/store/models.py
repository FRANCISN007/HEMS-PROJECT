from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.database import Base
#from app.vendor import Vendor  # ✅ adjust the path as needed
import os
from app.bar.models import Bar  # assuming this exists


# ----------------------------
# 1. Store Category
# ----------------------------
class StoreCategory(Base):
    __tablename__ = "store_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ----------------------------
# 2. Store Item
# ----------------------------
class StoreItem(Base):
    __tablename__ = "store_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    unit = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("store_categories.id"), nullable=True)
    unit_price = Column(Float, nullable=False, default=0.0)  # ✅ ADD THIS
    category = relationship("StoreCategory")

    created_at = Column(DateTime, default=datetime.utcnow)

    stock_entries = relationship("StoreStockEntry", back_populates="item")  # 🔧 This line fixes the error
    

# ----------------------------
# 3. Store Stock Entry (Purchase)
# ----------------------------
# models.py


class StoreStockEntry(Base):
    __tablename__ = "store_stock_entries"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"))
    item_name= Column(String, nullable=False)  # Track who created the purchase
    quantity = Column(Integer)
    invoice_number = Column(String(255), nullable=True)  # <-- Corrected
    original_quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=True)
    total_amount = Column(Float)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    purchase_date = Column(DateTime, default=datetime.utcnow)
    #created_by_id = Column(Integer, ForeignKey("users.id"))  
    created_by = Column(String, nullable=False)  # Track who created the purchase
    created_at = Column(DateTime, default=datetime.utcnow)
    attachment = Column(String, nullable=True)  # <-- New: file path

    # Relationships
    item = relationship("StoreItem")
    vendor = relationship("Vendor", back_populates="purchases")
    #created_by_user = relationship("User", lazy="joined")  

    #@property
    #def created_by(self):
        #return self.created_by_user.username if self.created_by_user else None

    @property
    def attachment_url(self):
        if self.attachment:
            return f"/attachments/store_invoices/{os.path.basename(self.attachment)}"
        return None
    


# ----------------------------
# 4. Store Issue
# ----------------------------
class StoreIssue(Base):
    __tablename__ = "store_issues"

    id = Column(Integer, primary_key=True, index=True)
    issue_to = Column(String, nullable=False)  # "bar" or "restaurant"
    issued_to_id = Column(Integer, ForeignKey("bars.id"), nullable=False)  # ✅ Proper FK
    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_date = Column(DateTime, default=datetime.utcnow)

    # Relationships
    issue_items = relationship("StoreIssueItem", back_populates="issue", cascade="all, delete-orphan")
    issued_to = relationship("Bar", back_populates="issues")  # ✅ Proper relationship

    items = relationship("StoreIssueItem", back_populates="issue", cascade="all, delete-orphan")

    

class StoreIssueItem(Base):
    __tablename__ = "store_issue_items"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("store_issues.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    


    issue = relationship("StoreIssue", back_populates="issue_items")
    item = relationship("StoreItem")




class StoreInventoryAdjustment(Base):
    __tablename__ = "store_inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)
    quantity_adjusted = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    adjusted_by = Column(String, nullable=False)
    adjusted_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("StoreItem")




class StoreInventory(Base):
    __tablename__ = "store_inventory"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), unique=True, nullable=False)
    quantity = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item = relationship("StoreItem")
