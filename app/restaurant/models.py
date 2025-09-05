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


    order_items = relationship("MealOrderItem", back_populates="meal")



class MealOrder(Base):
    __tablename__ = "meal_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_type = Column(String, nullable=False)  # "Room" or "POS"
    guest_name = Column(String, nullable=False)
    room_number = Column(String, nullable=True)  # nullable for POS
    location_id = Column(Integer, ForeignKey("restaurant_locations.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="open")  # change from "pending"


    location = relationship("RestaurantLocation")
    items = relationship("MealOrderItem", back_populates="order", cascade="all, delete-orphan")
    sale = relationship("RestaurantSale", back_populates="order", uselist=False)



class MealOrderItem(Base):
    __tablename__ = "meal_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("meal_orders.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    quantity = Column(Integer, nullable=False)
    status = Column(String, default="pending")  # "pending", "served"
    created_at = Column(DateTime, default=datetime.utcnow)

    meal = relationship("Meal", back_populates="order_items")
    order = relationship("MealOrder", back_populates="items")

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

