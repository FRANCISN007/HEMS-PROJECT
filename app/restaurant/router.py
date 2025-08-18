# restaurant/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from datetime import datetime
from typing import List
from app.users.auth import get_current_user
from app.users.models import User
from fastapi import Query
from datetime import date
from sqlalchemy import func
from app.users import schemas as user_schemas
from app.restaurant import models as restaurant_models
from app.restaurant import schemas as restaurant_schemas

from app.restaurant.models import MealOrder, MealOrderItem, Meal, RestaurantLocation
from app.restaurant.schemas import MealOrderCreate, MealOrderDisplay

from app.restaurant.models import MealOrder, RestaurantSale  # assuming MealOrder is in restaurant.models
from app.restpayment.models import RestaurantSalePayment     # payment model from restpayment folder
from app.restaurant.schemas import RestaurantSaleDisplay     # Sale schema

from app.restaurant.schemas import MealOrderItemDisplay


from sqlalchemy.orm import joinedload


router = APIRouter()

# Create a new restaurant location
@router.post("/locations", response_model=restaurant_schemas.RestaurantLocationDisplay)
def create_location(location: restaurant_schemas.RestaurantLocationCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    db_location = restaurant_models.RestaurantLocation(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


# Get all restaurant locations
@router.get("/locations", response_model=list[restaurant_schemas.RestaurantLocationDisplay])
def list_locations(
    db: Session = Depends(get_db),
                   
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    return db.query(restaurant_models.RestaurantLocation).all()


# Toggle location active status
@router.patch("/locations/{location_id}", response_model=restaurant_schemas.RestaurantLocationDisplay)
def toggle_location_active(location_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    location = db.query(restaurant_models.RestaurantLocation).filter_by(id=location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    location.active = not location.active
    db.commit()
    db.refresh(location)
    return location


@router.post("/meal-categories", response_model=restaurant_schemas.MealCategoryDisplay)
def create_meal_category(category: restaurant_schemas.MealCategoryCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    # Check if name exists
    existing = db.query(restaurant_models.MealCategory).filter_by(name=category.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meal category already exists")
    
    db_category = restaurant_models.MealCategory(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.get("/meal-categories", response_model=list[restaurant_schemas.MealCategoryDisplay])
def list_meal_categories(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    return db.query(restaurant_models.MealCategory).all()



# --- Meal Endpoints ---

@router.post("/meals", response_model=restaurant_schemas.MealDisplay)
def create_meal(meal: restaurant_schemas.MealCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    db_meal = restaurant_models.Meal(**meal.dict())
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.get("/meals", response_model=list[restaurant_schemas.MealDisplay])
def list_meals(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    return db.query(restaurant_models.Meal).all()


@router.patch("/meals/{meal_id}/toggle-availability", response_model=restaurant_schemas.MealDisplay)
def toggle_meal_availability(meal_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    meal = db.query(restaurant_models.Meal).filter_by(id=meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    meal.available = not meal.available
    db.commit()
    db.refresh(meal)
    return meal


@router.post("/", response_model=MealOrderDisplay)
def create_meal_order(order_data: MealOrderCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    # Create the MealOrder
    order = MealOrder(
        order_type=order_data.order_type,
        guest_name=order_data.guest_name,
        room_number=order_data.room_number,
        location_id=order_data.location_id,
        created_at=datetime.utcnow(),
        status=order_data.status or "pending"
    )
    db.add(order)
    db.flush()  # ensures order.id is available

    # Create and add MealOrderItems
    for item in order_data.items:
        db_item = MealOrderItem(
            meal_id=item.meal_id,
            quantity=item.quantity,
            order_id=order.id,
            status=order.status,
            created_at=datetime.utcnow()
        )
        db.add(db_item)

    db.commit()
    db.refresh(order)

    # Build items display list
    items = []
    order_items = db.query(MealOrderItem).filter(MealOrderItem.order_id == order.id).all()
    for item in order_items:
        meal = db.query(Meal).filter(Meal.id == item.meal_id).first()
        items.append(MealOrderItemDisplay(
            meal_id=item.meal_id,
            meal_name=meal.name if meal else None,
            quantity=item.quantity,
            price_per_unit=meal.price if meal else None,
            total_price=(meal.price * item.quantity) if meal else None,
        ))

    # Return full display model
    return MealOrderDisplay(
        id=order.id,
        location_id=order.location_id,
        order_type=order.order_type,
        room_number=order.room_number,
        guest_name=order.guest_name,
        status=order.status,
        created_at=order.created_at,
        items=items
    )





@router.get("/", response_model=list[MealOrderDisplay])
def list_meal_orders(
    status: str = Query(None, description="Filter by status: open or closed"),
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    query = db.query(MealOrder)

    if status:
        query = query.filter(MealOrder.status == status)

    if start_date:
        query = query.filter(MealOrder.created_at >= start_date)
    if end_date:
        query = query.filter(MealOrder.created_at <= end_date)

    orders = query.order_by(MealOrder.created_at.desc()).all()
    response = []

    for order in orders:
        items = []
        for item in order.items:
            meal = db.query(Meal).filter(Meal.id == item.meal_id).first()
            items.append(MealOrderItemDisplay(
                meal_id=item.meal_id,
                meal_name=meal.name if meal else None,
                quantity=item.quantity,
                price_per_unit=meal.price if meal else None,
                total_price=(meal.price * item.quantity) if meal else None,
            ))
        response.append(MealOrderDisplay(
            id=order.id,
            location_id=order.location_id,
            order_type=order.order_type,
            room_number=order.room_number,
            guest_name=order.guest_name,
            status=order.status,
            created_at=order.created_at,
            items=items
        ))

    return response






from sqlalchemy import func

@router.get("/sales", response_model=dict)
def list_sales(
    status: str = Query(None, description="Filter by status: unpaid, partial, paid"),
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    query = db.query(RestaurantSale)

    if status:
        query = query.filter(RestaurantSale.status == status)
    if start_date:
        query = query.filter(RestaurantSale.created_at >= start_date)
    if end_date:
        query = query.filter(RestaurantSale.created_at <= end_date)

    sales = query.order_by(RestaurantSale.created_at.desc()).all()
    result = []

    # Summary totals
    total_sales_amount = 0.0
    total_paid_amount = 0.0
    total_balance = 0.0

    for sale in sales:
        # Get order items
        order = sale.order
        items = []
        if order:
            items = [
                MealOrderItemDisplay.from_orm_with_meal(item)
                for item in order.items
            ]

        # Compute amount paid from payments
        amount_paid = sum(payment.amount_paid for payment in sale.payments)
        balance = sale.total_amount - amount_paid

        # Add to totals
        total_sales_amount += sale.total_amount
        total_paid_amount += amount_paid
        total_balance += balance

        sale_display = RestaurantSaleDisplay(
            id=sale.id,
            order_id=sale.order_id,
            served_by=sale.served_by,
            total_amount=sale.total_amount,
            amount_paid=amount_paid,
            balance=balance,
            status=sale.status,
            served_at=sale.served_at,
            created_at=sale.created_at,
            items=items
        )
        result.append(sale_display)

    summary = {
        "total_sales_amount": total_sales_amount,
        "total_paid_amount": total_paid_amount,
        "total_balance": total_balance
    }

    return {"sales": result, "summary": summary}



@router.get("/sales/{sale_id}", response_model=RestaurantSaleDisplay)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    order = sale.order

    if not order:
        items = []
    else:
        items = [
            MealOrderItemDisplay.from_orm_with_meal(item)
            for item in order.items
        ]

    return RestaurantSaleDisplay(
        id=sale.id,
        order_id=sale.order_id,
        served_by=sale.served_by,
        total_amount=sale.total_amount,
        status=sale.status,
        served_at=sale.served_at,
        created_at=sale.created_at,
        items=items
    )


@router.delete("/sales/{sale_id}")
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete sales.")

    # Check if the sale exists without accessing relationships
    sale_exists = db.query(RestaurantSale.id).filter(RestaurantSale.id == sale_id).first()
    if not sale_exists:
        raise HTTPException(status_code=404, detail="Sale not found.")

    # Check if a payment is attached to the sale
    payment_attached = db.query(RestaurantSalePayment.id).filter(RestaurantSalePayment.sale_id == sale_id).first()
    if payment_attached:
        raise HTTPException(status_code=400, detail="Sale has attached payments and cannot be deleted.")

    # Reopen associated meal order
    order = db.query(MealOrder).join(RestaurantSale, RestaurantSale.order_id == MealOrder.id).filter(RestaurantSale.id == sale_id).first()
    if order:
        order.status = "open"

    # Delete the sale
    db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).delete()

    db.commit()

    return {"detail": f"Sale {sale_id} deleted successfully."}




@router.post("/sales/from-order/{order_id}", response_model=RestaurantSaleDisplay)
def create_sale_from_order(
    order_id: int,
    served_by: str,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.status != "open":
        raise HTTPException(status_code=400, detail="Order is already closed and cannot be used to generate a sale.")

    # Calculate total from order items
    total = sum(item.meal.price * item.quantity for item in order.items if item.meal)

    # Create sale
    sale = RestaurantSale(
        order_id=order.id,
        served_by=served_by,
        total_amount=total,
        status="unpaid",
        served_at=datetime.utcnow()
    )
    db.add(sale)

    # Close the order
    order.status = "closed"

    db.commit()
    db.refresh(sale)

    items = [MealOrderItemDisplay.from_orm_with_meal(item) for item in order.items]

    amount_paid = sum(payment.amount for payment in sale.payments)
    balance = total - amount_paid

    return RestaurantSaleDisplay(
        id=sale.id,
        order_id=sale.order_id,
        served_by=sale.served_by,
        total_amount=sale.total_amount,
        amount_paid=amount_paid,       # ✅ Required field
        balance=balance,               # ✅ Required field
        status=sale.status,
        served_at=sale.served_at,
        created_at=sale.created_at,
        items=items
    )




@router.get("/{order_id}", response_model=MealOrderDisplay)
def get_meal_order(order_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    order_items = []
    for item in order.items:
        meal = db.query(Meal).filter(Meal.id == item.meal_id).first()
        order_items.append(MealOrderItemDisplay(
            meal_id=item.meal_id,
            meal_name=meal.name if meal else None,
            quantity=item.quantity,
            price_per_unit=meal.price if meal else None,
            total_price=(meal.price * item.quantity) if meal else None,
        ))

    return MealOrderDisplay(
        id=order.id,
        location_id=order.location_id,
        order_type=order.order_type,
        room_number=order.room_number,
        guest_name=order.guest_name,
        status=order.status,
        created_at=order.created_at,
        items=order_items
    )




@router.put("/{order_id}", response_model=MealOrderDisplay)
def update_meal_order(order_id: int, order_data: MealOrderCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    # Update basic fields
    order.guest_name = order_data.guest_name
    order.order_type = order_data.order_type
    order.room_number = order_data.room_number
    order.location_id = order_data.location_id

    # Remove old items
    db.query(MealOrderItem).filter(MealOrderItem.order_id == order_id).delete()

    # Add updated items
    for item in order_data.items:
        db_item = MealOrderItem(
            meal_id=item.meal_id,
            quantity=item.quantity,
            order_id=order.id,
            created_at=datetime.utcnow()
        )
        db.add(db_item)

    db.commit()
    db.refresh(order)

    # Build enriched order items list
    order_items = []
    for item in order.items:
        meal = db.query(Meal).filter(Meal.id == item.meal_id).first()
        order_items.append(MealOrderItemDisplay(
            meal_id=item.meal_id,
            meal_name=meal.name if meal else None,
            quantity=item.quantity,
            price_per_unit=meal.price if meal else None,
            total_price=(meal.price * item.quantity) if meal else None,
        ))

    return MealOrderDisplay(
        id=order.id,
        location_id=order.location_id,
        order_type=order.order_type,
        room_number=order.room_number,
        guest_name=order.guest_name,
        status=order.status,
        created_at=order.created_at,
        items=order_items
    )



@router.delete("/{order_id}")
def delete_meal_order(order_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    db.delete(order)
    db.commit()
    return {"detail": "Meal order deleted successfully"}



