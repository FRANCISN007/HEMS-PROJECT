# models/restaurant.py

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class RestaurantLocation(Base):
    __tablename__ = "restaurant_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    active = Column(Boolean, default=True)


# app/restaurant/models.py



class MealCategory(Base):
    __tablename__ = "meal_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)


class Meal(Base):
    __tablename__ = "meals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    available = Column(Boolean, default=True)

    category_id = Column(Integer, ForeignKey("meal_categories.id"))
    location_id = Column(Integer, ForeignKey("restaurant_locations.id"))

    category = relationship("MealCategory")
    location = relationship("RestaurantLocation")

    # links to store items via MealStoreItem
    store_links = relationship("MealStoreItem", back_populates="meal")

    order_items = relationship("MealOrderItem", back_populates="meal")




class MealOrder(Base):
    __tablename__ = "meal_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_type = Column(String, nullable=False)
    guest_name = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    location_id = Column(Integer, ForeignKey("restaurant_locations.id"))
    kitchen_id = Column(Integer, ForeignKey("kitchens.id"), nullable=False)  # kitchen for this order
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="open")
    created_by = Column(Integer, ForeignKey("users.id"))

    location = relationship("RestaurantLocation")
    kitchen = relationship("Kitchen")

    items = relationship(
        "MealOrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    sale = relationship("RestaurantSale", back_populates="order", uselist=False)




class MealOrderItem(Base):
    __tablename__ = "meal_order_items"

    id = Column(Integer, primary_key=True, index=True)

    # FK to order
    order_id = Column(Integer, ForeignKey("meal_orders.id"))

    # FK to meal
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=True)

    store_item_id = Column(Integer, ForeignKey("store_items.id"))
    quantity = Column(Integer, nullable=False)
    store_qty_used = Column(Integer, nullable=False)

    item_name = Column(String, nullable=False)
    price_per_unit = Column(Float, nullable=False, default=0.0)
    total_price = Column(Float, nullable=False, default=0.0)

    # REQUIRED RELATIONSHIP (THE ERROR COMPLAINED ABOUT THIS)
    order = relationship("MealOrder", back_populates="items")

    meal = relationship("Meal", back_populates="order_items")

     # ✅ ADD THIS
    store_item = relationship("StoreItem", back_populates="meal_order_items")


#RESTAURANT SALES

class RestaurantSale(Base):
    __tablename__ = "restaurant_sales"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("meal_orders.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("restaurant_locations.id"), nullable=False)  # ✅ FIXED
    guest_name = Column(String, nullable=True)
    served_by = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(String, default="unpaid")
    served_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("MealOrder", back_populates="sale")
    payments = relationship(
        "RestaurantSalePayment",
        back_populates="sale",
        cascade="all, delete"
    )
    #location = relationship("RestaurantLocation")  # ✅ optional relationship

class MealStoreItem(Base):
    __tablename__ = "meal_store_items"
    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"))
    store_item_id = Column(Integer, ForeignKey("store_items.id"))
    quantity_used = Column(Float, default=1)

    meal = relationship("Meal", back_populates="store_links")
    store_item = relationship("StoreItem")
