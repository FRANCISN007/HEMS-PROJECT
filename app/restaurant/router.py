# restaurant/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from datetime import datetime
from typing import List
from typing import Optional
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_location = restaurant_models.RestaurantLocation(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


# Get all restaurant locations in ascending order of ID
@router.get("/locations", response_model=list[restaurant_schemas.RestaurantLocationDisplay])
def list_locations(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    return db.query(restaurant_models.RestaurantLocation).order_by(restaurant_models.RestaurantLocation.id.asc()).all()


# Update restaurant location
@router.put("/locations/{location_id}", response_model=restaurant_schemas.RestaurantLocationDisplay)
def update_location(
    location_id: int,
    location_update: restaurant_schemas.RestaurantLocationCreate,  # reuse create schema since it's same fields
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_location = db.query(restaurant_models.RestaurantLocation).filter(
        restaurant_models.RestaurantLocation.id == location_id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    for key, value in location_update.dict().items():
        setattr(db_location, key, value)

    db.commit()
    db.refresh(db_location)
    return db_location


# Delete restaurant location
@router.delete("/locations/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    db_location = db.query(restaurant_models.RestaurantLocation).filter(
        restaurant_models.RestaurantLocation.id == location_id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    db.delete(db_location)
    db.commit()
    return {"message": "Location deleted successfully"}


# Toggle location active status
@router.patch("/locations/{location_id}", response_model=restaurant_schemas.RestaurantLocationDisplay)
def toggle_location_active(location_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    return db.query(restaurant_models.MealCategory).order_by(restaurant_models.MealCategory.id.asc()).all()


# ✅ Update Meal Category
@router.put("/meal-categories/{category_id}", response_model=restaurant_schemas.MealCategoryDisplay)
def update_meal_category(
    category_id: int,
    category_update: restaurant_schemas.MealCategoryCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_category = db.query(restaurant_models.MealCategory).filter_by(id=category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Meal category not found")

    # Prevent duplicate name (except for the same category)
    existing = db.query(restaurant_models.MealCategory).filter(
        restaurant_models.MealCategory.name == category_update.name,
        restaurant_models.MealCategory.id != category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meal category with this name already exists")

    db_category.name = category_update.name
    db.commit()
    db.refresh(db_category)
    return db_category

# ✅ Delete Meal Category
@router.delete("/meal-categories/{category_id}")
def delete_meal_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    db_category = db.query(restaurant_models.MealCategory).filter_by(id=category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Meal category not found")
    
    db.delete(db_category)
    db.commit()
    return {"detail": f"Meal category with id {category_id} deleted successfully"}


# --- Meal Endpoints ---

@router.post("/meals", response_model=restaurant_schemas.MealDisplay)
def create_meal(meal: restaurant_schemas.MealCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_meal = restaurant_models.Meal(**meal.dict())
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.get("/meals", response_model=list[restaurant_schemas.MealDisplay])
def list_meals(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    return db.query(restaurant_models.Meal).order_by(restaurant_models.Meal.id.asc()).all()

# ✅ Update Meal
@router.put("/meals/{meal_id}", response_model=restaurant_schemas.MealDisplay)
def update_meal(
    meal_id: int,
    meal: restaurant_schemas.MealCreate,   # you can also create a MealUpdate schema if needed
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_meal = db.query(restaurant_models.Meal).filter(restaurant_models.Meal.id == meal_id).first()
    if not db_meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    for key, value in meal.dict().items():
        setattr(db_meal, key, value)

    db.commit()
    db.refresh(db_meal)
    return db_meal


# ✅ Delete Meal
@router.delete("/meals/{meal_id}", response_model=dict)
def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    db_meal = db.query(restaurant_models.Meal).filter(restaurant_models.Meal.id == meal_id).first()
    if not db_meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    db.delete(db_meal)
    db.commit()
    return {"detail": "Meal deleted successfully"}


@router.patch("/meals/{meal_id}/toggle-availability", response_model=restaurant_schemas.MealDisplay)
def toggle_meal_availability(meal_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    meal = db.query(restaurant_models.Meal).filter_by(id=meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    meal.available = not meal.available
    db.commit()
    db.refresh(meal)
    return meal


@router.post("/orders/", response_model=MealOrderDisplay)
def create_meal_order(order_data: MealOrderCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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





from datetime import datetime, timedelta

@router.get("/list", response_model=list[MealOrderDisplay])
def list_meal_orders(
    status: str = Query(None, description="Filter by status: open or closed"),
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    location_id: int = Query(None, description="Filter by location ID"),  # ✅ new filter
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(MealOrder)

    # ✅ filter by location first
    if location_id:
        query = query.filter(MealOrder.location_id == location_id)

    if status:
        query = query.filter(MealOrder.status == status)

    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(MealOrder.created_at >= start_datetime)

    if end_date:
        # ✅ include entire end date by setting time to 23:59:59
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(MealOrder.created_at <= end_datetime)

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





from datetime import datetime
from typing import Optional

from datetime import datetime, date, timedelta  # make sure this is at the top

from datetime import datetime, date

@router.get("/sales", response_model=dict)
def list_sales(
    status: Optional[str] = Query(None, description="Filter by status: unpaid, partial, paid"),
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    location_id: Optional[int] = Query(None, description="Filter sales by restaurant location"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(RestaurantSale)

    # ✅ Status filter
    if status:
        query = query.filter(RestaurantSale.status == status)

    # ✅ Date filters (inclusive, using served_at)
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(RestaurantSale.served_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(RestaurantSale.served_at <= end_dt)

    # ✅ Prevent invalid date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    # ✅ Always order by served_at, fallback to created_at if None
    sales = query.order_by(RestaurantSale.served_at.desc().nullslast(),
                           RestaurantSale.created_at.desc()).all()

    result = []
    total_sales_amount = 0.0
    total_paid_amount = 0.0
    total_balance = 0.0

    for sale in sales:
        order = sale.order
        items = []
        order_location_id = None
        guest_name = None

        if order:
            order_location_id = order.location_id
            guest_name = order.guest_name
            items = [
                MealOrderItemDisplay.from_orm_with_meal(item)
                for item in order.items
            ]

        # ✅ Location filter
        if location_id is not None and order_location_id != location_id:
            continue

        amount_paid = sum(
            (payment.amount_paid or 0)
            for payment in sale.payments
            if not payment.is_void
        )
        balance = (sale.total_amount or 0) - amount_paid

        total_sales_amount += (sale.total_amount or 0)
        total_paid_amount += amount_paid
        total_balance += balance

        sale_display = {
            "id": sale.id,
            "order_id": sale.order_id,
            "guest_name": guest_name,
            "location_id": order_location_id,
            "served_by": sale.served_by,
            "total_amount": sale.total_amount,
            "amount_paid": amount_paid,
            "balance": balance,
            "status": sale.status,
            "served_at": sale.served_at,
            "created_at": sale.created_at,
            "items": items,
        }
        result.append(sale_display)

    summary = {
        "total_sales_amount": total_sales_amount,
        "total_paid_amount": total_paid_amount,
        "total_balance": total_balance,
    }

    return {"sales": result, "summary": summary}


@router.get("/sales/items-summary", response_model=dict)
def summarize_items_sold(
    status: Optional[str] = Query(None, description="Filter by status: unpaid, partial, paid"),
    start_date: Optional[date] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[date] = Query(None, description="End date in YYYY-MM-DD format"),
    location_id: Optional[int] = Query(None, description="Filter sales by restaurant location"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(RestaurantSale)

    # ✅ Apply same filters as /sales
    if status:
        query = query.filter(RestaurantSale.status == status)

    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(RestaurantSale.served_at >= start_dt)

    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(RestaurantSale.served_at <= end_dt)

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    sales = query.all()

    # ✅ Aggregate items
    item_summary = {}
    grand_total = 0.0

    for sale in sales:
        order = sale.order
        if not order:
            continue

        # ✅ Location filter
        if location_id is not None and order.location_id != location_id:
            continue

        for item in order.items:
            meal_item = MealOrderItemDisplay.from_orm_with_meal(item)

            name = meal_item.meal_name
            qty = meal_item.quantity
            price = meal_item.price_per_unit   # ✅ use price_per_unit instead of price
            amount = meal_item.total_price or (qty * (price or 0))

            if name not in item_summary:
                item_summary[name] = {"qty": 0, "price": price, "amount": 0}

            item_summary[name]["qty"] += qty
            item_summary[name]["amount"] += amount
            grand_total += amount

    # ✅ Convert dict → list
    items_sold = [
        {
            "item": name,
            "qty": data["qty"],
            "price": data["price"],
            "amount": data["amount"],
        }
        for name, data in item_summary.items()
    ]

    return {
        "items_sold": items_sold,
        "grand_total": grand_total
    }




@router.get("/sales/outstanding", response_model=dict)
def list_outstanding(
    location_id: int = Query(None, description="Filter by location"),
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # ✅ Get all sales (not filtering by status, we’ll compute balance ourselves)
    query = db.query(RestaurantSale)

    # ✅ Filter by location if provided
    if location_id:
        query = query.join(RestaurantSale.order).filter(MealOrder.location_id == location_id)

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
        order = sale.order
        items = []
        location_id = None
        location_name = None
        guest_name = None

        if order:
            location_id = order.location_id
            guest_name = order.guest_name
            if order.location:
                location_name = order.location.name
            items = [
                MealOrderItemDisplay.from_orm_with_meal(item)
                for item in order.items
            ]

        # ✅ Compute payments excluding voided ones
        valid_payments = [p for p in sale.payments if not p.is_void]
        amount_paid = sum(p.amount_paid for p in valid_payments)
        balance = float(sale.total_amount or 0) - float(amount_paid or 0)

        if balance <= 0:
            continue  # ✅ Only list sales with positive balance

        # Update totals
        total_sales_amount += float(sale.total_amount or 0)
        total_paid_amount += float(amount_paid or 0)
        total_balance += float(balance or 0)

        sale_display = {
            "id": sale.id,
            "order_id": sale.order_id,
            "guest_name": guest_name,
            "location_id": location_id,
            "served_by": sale.served_by,
            "total_amount": float(sale.total_amount or 0),
            "amount_paid": float(amount_paid or 0),
            "balance": float(balance or 0),
            "status": "partial" if amount_paid > 0 else "unpaid",  # ✅ Dynamic status
            "served_at": sale.served_at,
            "created_at": sale.created_at,
            "items": items,
            "payments": [
                {
                    "id": p.id,
                    "amount_paid": float(p.amount_paid or 0),
                    "payment_mode": p.payment_mode,
                    "paid_by": p.paid_by,
                    "created_at": p.created_at,
                }
                for p in valid_payments
            ]
        }
        result.append(sale_display)

    summary = {
        "total_sales_amount": float(total_sales_amount),
        "total_paid_amount": float(total_paid_amount),
        "total_balance": float(total_balance),
    }

    return {"sales": result, "summary": summary}


@router.get("/sales/{sale_id}", response_model=RestaurantSaleDisplay)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can delete sales.")

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
    location_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.status != "open":
        raise HTTPException(
            status_code=400,
            detail="Order is already closed and cannot be used to generate a sale."
        )

    total = sum(item.meal.price * item.quantity for item in order.items if item.meal)

    sale = RestaurantSale(
        order_id=order.id,
        location_id=location_id,   # ✅ only use the request param
        guest_name=order.guest_name,
        served_by=served_by,
        total_amount=total,
        status="unpaid",
        served_at=datetime.utcnow()
    )
    db.add(sale)

    order.status = "closed"
    db.commit()
    db.refresh(sale)

    items = [MealOrderItemDisplay.from_orm_with_meal(item) for item in order.items]
    amount_paid = sum(payment.amount for payment in sale.payments)
    balance = total - amount_paid

    return RestaurantSaleDisplay(
        id=sale.id,
        order_id=sale.order_id,
        location_id=sale.location_id,
        guest_name=sale.guest_name,
        served_by=sale.served_by,
        total_amount=sale.total_amount,
        amount_paid=amount_paid,
        balance=balance,
        status=sale.status,
        served_at=sale.served_at,
        created_at=sale.created_at,
        items=items
    )


@router.get("/open")
def list_open_meal_orders(
    location_id: Optional[int] = Query(None, description="Filter open orders by location id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    """
    Return open meal orders. If location_id is provided, restrict to that location.
    Returns an object with total_entries, total_amount and orders (empty array if none).
    """
    query = db.query(MealOrder).filter(MealOrder.status == "open")
    if location_id is not None:
        query = query.filter(MealOrder.location_id == location_id)

    orders = query.order_by(MealOrder.id.asc()).all()

    result = []
    total_amount = 0.0

    for order in orders:
        order_items = []
        for item in order.items:
            meal = db.query(Meal).filter(Meal.id == item.meal_id).first()
            item_total = (meal.price * item.quantity) if meal else 0
            total_amount += item_total

            order_items.append(
                MealOrderItemDisplay(
                    meal_id=item.meal_id,
                    meal_name=meal.name if meal else None,
                    quantity=item.quantity,
                    price_per_unit=meal.price if meal else None,
                    total_price=item_total,
                )
            )

        result.append(
            MealOrderDisplay(
                id=order.id,
                location_id=order.location_id,
                order_type=order.order_type,
                room_number=order.room_number,
                guest_name=order.guest_name,
                status=order.status,
                created_at=order.created_at,
                items=order_items,
            )
        )

    return {
        "total_entries": len(orders),
        "total_amount": total_amount,
        "orders": result,
    }


@router.get("/{order_id}", response_model=MealOrderDisplay)
def get_meal_order(order_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
def update_meal_order(
    order_id: int,
    order_data: MealOrderCreate, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    # 🚫 Prevent editing closed orders
    if order.status.lower() == "closed":
        raise HTTPException(status_code=400, detail="Closed orders cannot be edited")

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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    db.delete(order)
    db.commit()
    return {"detail": "Meal order deleted successfully"}



