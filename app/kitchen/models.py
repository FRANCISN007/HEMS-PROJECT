from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class Kitchen(Base):
    __tablename__ = "kitchens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    inventories = relationship("KitchenInventory", back_populates="kitchen")
    issues = relationship("StoreIssue", back_populates="kitchen")
    stocks = relationship("KitchenStock", back_populates="kitchen")  # <-- add this


     # NEW RELATIONSHIPS



    

    


class KitchenInventory(Base):
    __tablename__ = "kitchen_inventories"

    id = Column(Integer, primary_key=True)
    kitchen_id = Column(Integer, ForeignKey("kitchens.id"))
    item_id = Column(Integer, ForeignKey("store_items.id"))
    quantity = Column(Integer, default=0)

    kitchen = relationship("Kitchen", back_populates="inventories")



class KitchenStock(Base):
    """
    Used for tracking historical usage:
    - total issued to kitchen
    - total used/sold in meals
    Helps for analysis and future reporting.
    """
    __tablename__ = "kitchen_stock"

    id = Column(Integer, primary_key=True, index=True)
    kitchen_id = Column(Integer, ForeignKey("kitchens.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)

    total_issued = Column(Float, default=0, nullable=False)
    total_used = Column(Float, default=0, nullable=False)

    kitchen = relationship("Kitchen", back_populates="stocks")
    item = relationship("StoreItem")

    __table_args__ = (
        UniqueConstraint("kitchen_id", "item_id", name="uq_kitchen_stock"),
    )

class KitchenMenu(Base):
    __tablename__ = "kitchen_menu"

    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)
    selling_price = Column(Float, nullable=False)

    item = relationship("StoreItem")
