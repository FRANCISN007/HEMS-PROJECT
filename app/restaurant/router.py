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
from sqlalchemy.exc import SQLAlchemyError

from app.users import schemas as user_schemas
from app.restaurant import models as restaurant_models
from app.restaurant import schemas as restaurant_schemas
from app.store import  models as store_models
from app.kitchen import models as kitchen_models

from app.restaurant.models import MealOrder, MealOrderItem, Meal, RestaurantLocation
from app.restaurant.schemas import MealOrderCreate, MealOrderDisplay
from app.store.models import StoreStockEntry, StoreItem

from app.restaurant.models import MealOrder, RestaurantSale  # assuming MealOrder is in restaurant.models
from app.restpayment.models import RestaurantSalePayment     # payment model from restpayment folder
from app.restaurant.schemas import RestaurantSaleDisplay     # Sale schema

from app.restaurant.schemas import MealOrderItemDisplay


from sqlalchemy.orm import joinedload


router = APIRouter()

# Create a new restaurant location
# ----------------------------
# Create a restaurant location
# ----------------------------
@router.post("/locations", response_model=restaurant_schemas.RestaurantLocationDisplay)
def create_location(
    location: restaurant_schemas.RestaurantLocationCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    db_location = restaurant_models.RestaurantLocation(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


# ----------------------------
# List all restaurant locations
# ----------------------------
@router.get("/locations", response_model=list[restaurant_schemas.RestaurantLocationDisplay])
def list_locations(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    return db.query(restaurant_models.RestaurantLocation).order_by(
        restaurant_models.RestaurantLocation.id.asc()
    ).all()


# ----------------------------
# Update restaurant location
# ----------------------------
@router.put("/locations/{location_id}", response_model=restaurant_schemas.RestaurantLocationDisplay)
def update_location(
    location_id: int,
    location_update: restaurant_schemas.RestaurantLocationCreate,
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

#
@router.post("/meal-categories", response_model=restaurant_schemas.MealCategoryDisplay)
def create_meal_category(
    category: restaurant_schemas.MealCategoryCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # Check if category name already exists
    existing = (
        db.query(restaurant_models.MealCategory)
        .filter_by(name=category.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Meal category already exists")

    # Create new meal category
    db_category = restaurant_models.MealCategory(name=category.name)
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

@router.get("/items/simple", response_model=List[restaurant_schemas.RestaurantMealItem])
def get_restaurant_items(db: Session = Depends(get_db)):
    """
    Fetch all kitchen store items with their latest selling price from KitchenMenu.
    Include items even if they do not have a KitchenMenu entry yet (price=0).
    """
    # Subquery: latest menu id per item
    subquery = (
        db.query(
            kitchen_models.KitchenMenu.item_id,
            func.max(kitchen_models.KitchenMenu.id).label("latest_menu_id")
        )
        .group_by(kitchen_models.KitchenMenu.item_id)
        .subquery()
    )

    # Left join store items to latest KitchenMenu (so we don't lose items without price yet)
    items = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.item_type.label("item_type"),
            kitchen_models.KitchenMenu.selling_price.label("selling_price"),
        )
        .outerjoin(subquery, subquery.c.item_id == store_models.StoreItem.id)
        .outerjoin(kitchen_models.KitchenMenu, kitchen_models.KitchenMenu.id == subquery.c.latest_menu_id)
        .filter(store_models.StoreItem.item_type == "kitchen")
        .order_by(store_models.StoreItem.name.asc())
        .all()
    )

    # Convert to schema format
    result = [
        restaurant_schemas.RestaurantMealItem(
            id=item.item_id,
            name=item.item_name,
            price=item.selling_price or 0,
            item_type=item.item_type
        )
        for item in items
    ]

    return result

@router.post("/meal-orders", response_model=restaurant_schemas.MealOrderDisplay)
def create_meal_order(
    order: restaurant_schemas.MealOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(role_required(["restaurant"]))
):
    # Validate location
    location = db.query(restaurant_models.RestaurantLocation).filter(
        restaurant_models.RestaurantLocation.id == order.location_id
    ).first()
    if not location:
        raise HTTPException(404, "Restaurant location not found.")

    # Validate kitchen
    kitchen = db.query(store_models.Kitchen).filter(
        store_models.Kitchen.id == order.kitchen_id
    ).first()
    if not kitchen:
        raise HTTPException(404, "Selected kitchen not found.")

    kitchen_items = db.query(store_models.StoreItem).filter(
        func.lower(store_models.StoreItem.item_type).in_(["kitchen", "meal", "food"])
    ).all()
    kitchen_map = {item.id: item for item in kitchen_items}

    # Validate quantities & stock
    for it in order.items:
        if it.quantity <= 0:
            raise HTTPException(400, f"Invalid quantity for item {it.store_item_id}. Must be > 0.")
        if it.store_item_id not in kitchen_map:
            raise HTTPException(404, f"Item {it.store_item_id} is not a valid kitchen item.")

        inventory = db.query(kitchen_models.KitchenInventory).filter(
            kitchen_models.KitchenInventory.kitchen_id == order.kitchen_id,
            kitchen_models.KitchenInventory.item_id == it.store_item_id
        ).first()
        available_qty = inventory.quantity if inventory else 0
        if available_qty < it.quantity:
            raise HTTPException(
                400,
                f"Not enough '{kitchen_map[it.store_item_id].name}' in kitchen inventory. "
                f"Requested: {it.quantity}, Available: {available_qty}"
            )

    # Create MealOrder
    db_order = restaurant_models.MealOrder(
        order_type=order.order_type,
        guest_name=order.guest_name,
        room_number=order.room_number,
        location_id=order.location_id,
        kitchen_id=order.kitchen_id,
        status=order.status or "open",
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # Deduct stock & create items
    for it in order.items:
        store_item = kitchen_map[it.store_item_id]
        qty_needed = it.quantity

        inventory = db.query(kitchen_models.KitchenInventory).filter(
            kitchen_models.KitchenInventory.kitchen_id == order.kitchen_id,
            kitchen_models.KitchenInventory.item_id == store_item.id
        ).first()
        inventory.quantity -= qty_needed
        db.add(inventory)

        price_per_unit = it.price_per_unit if it.price_per_unit > 0 else store_item.unit_price

        db_item = restaurant_models.MealOrderItem(
            order_id=db_order.id,
            store_item_id=store_item.id,
            quantity=qty_needed,
            store_qty_used=qty_needed,
            item_name=store_item.name,
            price_per_unit=price_per_unit,
            total_price=price_per_unit * qty_needed,
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_order)
    return db_order






@router.get("/meal-orders", response_model=List[restaurant_schemas.MealOrderDisplay])
def list_meal_orders(
    status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    location_id: Optional[int] = Query(None),
    kitchen_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(restaurant_models.MealOrder)

    # --- Apply Filters ---
    if location_id:
        query = query.filter(restaurant_models.MealOrder.location_id == location_id)

    if kitchen_id:
        query = query.filter(restaurant_models.MealOrder.kitchen_id == kitchen_id)

    if status:
        query = query.filter(restaurant_models.MealOrder.status == status)

    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(restaurant_models.MealOrder.created_at >= start_dt)

    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(restaurant_models.MealOrder.created_at <= end_dt)

    orders = query.order_by(restaurant_models.MealOrder.created_at.desc()).all()

    # --- Build Response ---
    response = []
    for order in orders:
        items_display = [
            restaurant_schemas.MealOrderItemDisplay(
                store_item_id=item.store_item_id,
                item_name=item.item_name,
                quantity=item.quantity,
                price_per_unit=item.price_per_unit,
                total_price=item.total_price,
            )
            for item in order.items
        ]

        response.append(
            restaurant_schemas.MealOrderDisplay(
                id=order.id,
                location_id=order.location_id,
                kitchen_id=order.kitchen_id,     # ★ NEW FIELD
                order_type=order.order_type,
                room_number=order.room_number,
                guest_name=order.guest_name,
                status=order.status,
                created_at=order.created_at,
                items=items_display,
            )
        )

    return response




@router.put("/meal-orders/{order_id}", response_model=restaurant_schemas.MealOrderDisplay)
def update_meal_order(
    order_id: int,
    data: restaurant_schemas.MealOrderCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"])),
):
    # --------------------------------------------------
    # 0️⃣ FETCH ORDER
    # --------------------------------------------------
    order = db.query(restaurant_models.MealOrder).filter(
        restaurant_models.MealOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(404, "Meal order not found")

    if order.status == "closed":
        raise HTTPException(400, "Closed orders cannot be edited")

    # If you want orders to allow changing kitchens:
    kitchen_id = data.kitchen_id if data.kitchen_id else order.kitchen_id

    # Ensure kitchen exists
    kitchen = db.query(store_models.Kitchen).filter(
        store_models.Kitchen.id == kitchen_id
    ).first()
    if not kitchen:
        raise HTTPException(404, "Selected kitchen not found.")

    try:
        # --------------------------------------------------
        # 1️⃣ RESTORE STOCK FOR OLD ITEMS
        # --------------------------------------------------
        for old_item in order.items:
            inventory = db.query(kitchen_models.KitchenInventory).filter(
                kitchen_models.KitchenInventory.kitchen_id == order.kitchen_id,
                kitchen_models.KitchenInventory.item_id == old_item.store_item_id
            ).first()

            if inventory:
                inventory.quantity += old_item.store_qty_used
                db.add(inventory)

        db.flush()

        # --------------------------------------------------
        # 2️⃣ VALIDATE NEW ITEMS AGAINST NEW KITCHEN STOCK
        # --------------------------------------------------
        for item in data.items:
            store_item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == item.store_item_id,
                func.lower(store_models.StoreItem.item_type).in_(
                    ["kitchen", "kitchen items", "meal", "food"]
                )
            ).first()

            if not store_item:
                raise HTTPException(400, f"Item {item.store_item_id} is not a kitchen item.")

            inventory = db.query(kitchen_models.KitchenInventory).filter(
                kitchen_models.KitchenInventory.kitchen_id == kitchen_id,
                kitchen_models.KitchenInventory.item_id == store_item.id
            ).first()

            available_qty = inventory.quantity if inventory else 0

            if available_qty < item.quantity:
                raise HTTPException(
                    400,
                    f"Not enough '{store_item.name}'. "
                    f"Available: {available_qty}, Needed: {item.quantity}"
                )

        # --------------------------------------------------
        # 3️⃣ DELETE OLD ITEMS
        # --------------------------------------------------
        db.query(restaurant_models.MealOrderItem).filter(
            restaurant_models.MealOrderItem.order_id == order.id
        ).delete()

        db.flush()

        # --------------------------------------------------
        # 4️⃣ UPDATE MAIN ORDER FIELDS
        # --------------------------------------------------
        order.order_type = data.order_type
        order.room_number = data.room_number
        order.guest_name = data.guest_name
        order.location_id = data.location_id
        order.kitchen_id = kitchen_id  # 🔥 kitchen now tied to order

        # --------------------------------------------------
        # 5️⃣ INSERT NEW ITEMS + DEDUCT STOCK
        # --------------------------------------------------
        for item in data.items:
            store_item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == item.store_item_id
            ).first()

            inventory = db.query(kitchen_models.KitchenInventory).filter(
                kitchen_models.KitchenInventory.kitchen_id == kitchen_id,
                kitchen_models.KitchenInventory.item_id == store_item.id
            ).first()

            inventory.quantity -= item.quantity
            db.add(inventory)

            price_per_unit = item.price_per_unit or store_item.unit_price

            db_item = restaurant_models.MealOrderItem(
                order_id=order.id,
                store_item_id=store_item.id,
                item_name=store_item.name,
                quantity=item.quantity,
                store_qty_used=item.quantity,
                price_per_unit=price_per_unit,
                total_price=price_per_unit * item.quantity
            )
            db.add(db_item)

        db.commit()
        db.refresh(order)

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Could not update meal order: {str(e)}")

    # --------------------------------------------------
    # 6️⃣ BUILD RESPONSE
    # --------------------------------------------------
    items_display = [
        restaurant_schemas.MealOrderItemDisplay(
            store_item_id=i.store_item_id,
            item_name=i.item_name,
            quantity=i.quantity,
            price_per_unit=i.price_per_unit,
            total_price=i.total_price,
        )
        for i in order.items
    ]

    return restaurant_schemas.MealOrderDisplay(
        id=order.id,
        location_id=order.location_id,
        kitchen_id=order.kitchen_id,
        order_type=order.order_type,
        room_number=order.room_number,
        guest_name=order.guest_name,
        status=order.status,
        created_at=order.created_at,
        items=items_display,
    )


# ✅ Delete Meal
@router.delete("/meal-orders/{order_id}", response_model=dict)
def delete_meal_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant", "admin"]))
):
    # 1️⃣ Fetch the meal order
    db_order = db.query(restaurant_models.MealOrder).filter(
        restaurant_models.MealOrder.id == order_id
    ).first()

    if not db_order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    # 2️⃣ Delete the order (MealOrderItem will cascade)
    db.delete(db_order)
    db.commit()

    return {"detail": "Meal order deleted successfully"}


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




@router.post("/map")
def map_store_item_to_store_item(
    store_item_id: int,
    quantity_used: float = 1,
    db: Session = Depends(get_db),
    current_user=Depends(role_required(["restaurant"]))
):
    # ✅ Check if store item exists
    store_item = db.query(StoreItem).filter(StoreItem.id == store_item_id).first()
    if not store_item:
        raise HTTPException(status_code=404, detail="Store item not found")

    # ✅ Create mapping using store_item_id only
    link = StoreItem(
        store_item_id=store_item_id,
        quantity_used=quantity_used
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    return {"message": "Mapping created successfully", "data": {
        "id": link.id,
        "store_item_id": link.store_item_id,
        "quantity_used": link.quantity_used
    }}




from sqlalchemy.orm import joinedload



@router.get("/sales", response_model=dict)
def list_sales(
    status: Optional[str] = Query(None, description="Filter by status: unpaid, partial, paid"),
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    location_id: Optional[int] = Query(None, description="Filter sales by restaurant location"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(restaurant_models.RestaurantSale)

    # 1️⃣ Status filter
    if status:
        query = query.filter(restaurant_models.RestaurantSale.status == status)

    # 2️⃣ Date filters (inclusive)
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(restaurant_models.RestaurantSale.served_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(restaurant_models.RestaurantSale.served_at <= end_dt)

    # 3️⃣ Prevent invalid date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    # 4️⃣ Order by served_at descending, fallback to created_at
    sales = query.order_by(
        restaurant_models.RestaurantSale.served_at.desc().nullslast(),
        restaurant_models.RestaurantSale.created_at.desc()
    ).all()

    result = []
    total_sales_amount = 0.0
    total_paid_amount = 0.0
    total_balance = 0.0

    for sale in sales:
        order = sale.order
        items_display = []
        order_location_id = None
        guest_name = None

        if order:
            order_location_id = order.location_id
            guest_name = order.guest_name
            items_display = [
                restaurant_schemas.MealOrderItemDisplay.from_orm(item)
                for item in order.items
            ]

        # 5️⃣ Location filter
        if location_id is not None and order_location_id != location_id:
            continue

        # 6️⃣ Calculate payments & balance
        amount_paid = sum(
            (payment.amount_paid or 0)
            for payment in sale.payments
            if not payment.is_void
        )
        balance = (sale.total_amount or 0) - amount_paid

        total_sales_amount += (sale.total_amount or 0)
        total_paid_amount += amount_paid
        total_balance += balance

        # 🔥 7️⃣ Compute status dynamically
        if amount_paid == 0:
            computed_status = "unpaid"
        elif 0 < amount_paid < (sale.total_amount or 0):
            computed_status = "partial"
        else:
            computed_status = "paid"

        sale_display = {
            "id": sale.id,
            "order_id": sale.order_id,
            "guest_name": guest_name,
            "location_id": order_location_id,
            "served_by": sale.served_by,
            "total_amount": sale.total_amount,
            "amount_paid": amount_paid,
            "balance": balance,
            "status": computed_status,   # <-- 🔥 fixed here
            "served_at": sale.served_at,
            "created_at": sale.created_at,
            "items": items_display,
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
    status: Optional[str] = Query(None, description="Filter by sale status: unpaid, partial, paid"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    location_id: Optional[int] = Query(None, description="Filter by restaurant location"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # ===============================
    # 1) Base Query
    # ===============================
    query = (
        db.query(RestaurantSale)
        .join(RestaurantSale.order)
        .options(
            joinedload(RestaurantSale.order)
            .joinedload(MealOrder.items)
            .joinedload(MealOrderItem.store_item)  # Load store_item relationship
        )
    )

    # ===============================
    # 2) Filters
    # ===============================
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

    if location_id:
        query = query.filter(MealOrder.location_id == location_id)

    sales = query.all()

    # ===============================
    # 3) Aggregation
    # ===============================
    item_summary = {}
    grand_total = 0.0

    for sale in sales:
        order = sale.order
        if not order:
            continue

        for item in order.items:

            # ✅ Prefer store_item name & unit_price
            store_item = item.store_item
            if not store_item:
                raise HTTPException(
                    status_code=500,
                    detail=f"Store item missing for order item ID {item.id}. Data integrity issue."
                )

            name = store_item.name
            price = store_item.unit_price or item.price_per_unit or 0
            qty = item.quantity
            amount = item.total_price or (qty * price)

            if name not in item_summary:
                item_summary[name] = {"qty": 0, "price": price, "amount": 0}

            item_summary[name]["qty"] += qty
            item_summary[name]["amount"] += amount
            grand_total += amount

    # ===============================
    # 4) Format Response
    # ===============================
    items = [
        {
            "item": name,
            "qty": data["qty"],
            "price": data["price"],
            "amount": data["amount"],
        }
        for name, data in item_summary.items()
    ]

    summary = {
        "grand_total": grand_total,
        "total_items": len(items)
    }

    return {
        "items": items,
        "summary": summary
    }


@router.get("/sales/outstanding", response_model=dict)
def list_outstanding_sales(
    location_id: Optional[int] = Query(None, description="Filter by restaurant location"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(restaurant_models.RestaurantSale)

    # 1️⃣ Date filters
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(restaurant_models.RestaurantSale.served_at >= start_dt)

    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(restaurant_models.RestaurantSale.served_at <= end_dt)

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    # 2️⃣ Order results
    sales = query.order_by(
        restaurant_models.RestaurantSale.served_at.desc().nullslast(),
        restaurant_models.RestaurantSale.created_at.desc()
    ).all()

    result = []
    total_sales_amount = 0.0
    total_paid_amount = 0.0
    total_balance = 0.0

    for sale in sales:
        order = sale.order
        items_display = []
        order_location_id = None
        guest_name = None

        if order:
            order_location_id = order.location_id
            guest_name = order.guest_name
            items_display = [
                restaurant_schemas.MealOrderItemDisplay.from_orm(item)
                for item in order.items
            ]

        # 3️⃣ Location filter
        if location_id is not None and order_location_id != location_id:
            continue

        # 4️⃣ Compute payments
        amount_paid = sum(
            (payment.amount_paid or 0)
            for payment in sale.payments
            if not payment.is_void
        )

        balance = (sale.total_amount or 0) - amount_paid

        # 5️⃣ Outstanding only
        if balance <= 0:
            continue

        # 6️⃣ Totals update
        total_sales_amount += (sale.total_amount or 0)
        total_paid_amount += amount_paid
        total_balance += balance

        result.append({
            "id": sale.id,
            "order_id": sale.order_id,
            "guest_name": guest_name,
            "location_id": order_location_id,
            "served_by": sale.served_by,
            "total_amount": sale.total_amount,
            "amount_paid": amount_paid,
            "balance": balance,
            "status": sale.status,  # You can recompute if needed
            "served_at": sale.served_at,
            "created_at": sale.created_at,
            "items": items_display,
        })

    summary = {
        "total_sales_amount": total_sales_amount,
        "total_paid_amount": total_paid_amount,
        "total_balance": total_balance,
    }

    return {"sales": result, "summary": summary}


@router.get("/sales/{sale_id}", response_model=restaurant_schemas.RestaurantSaleDisplay)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # 1️⃣ Fetch the sale
    sale = db.query(restaurant_models.RestaurantSale).filter(
        restaurant_models.RestaurantSale.id == sale_id
    ).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # 2️⃣ Fetch the associated order
    order = sale.order
    items_display = []
    order_location_id = None
    guest_name = None

    if order:
        order_location_id = order.location_id
        guest_name = order.guest_name
        items_display = [
            restaurant_schemas.MealOrderItemDisplay.from_orm(item)
            for item in order.items
        ]

    # 3️⃣ Calculate amount paid & balance
    amount_paid = sum(
        (payment.amount_paid or 0)
        for payment in sale.payments
        if not payment.is_void
    )
    balance = (sale.total_amount or 0) - amount_paid

    # 4️⃣ Return the structured sale
    return restaurant_schemas.RestaurantSaleDisplay(
        id=sale.id,
        order_id=sale.order_id,
        guest_name=guest_name,
        location_id=order_location_id,
        served_by=sale.served_by,
        total_amount=sale.total_amount,
        amount_paid=amount_paid,
        balance=balance,
        status=sale.status,
        served_at=sale.served_at,
        created_at=sale.created_at,
        items=items_display
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



@router.post("/sales/from-order/{order_id}", response_model=restaurant_schemas.RestaurantSaleDisplay)
def create_sale_from_order(
    order_id: int,
    served_by: str,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    try:
        # -------------------------
        # 1) fetch & validate order
        # -------------------------
        order = (
            db.query(restaurant_models.MealOrder)
            .filter(restaurant_models.MealOrder.id == order_id)
            .first()
        )

        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")

        if order.status != "open":
            raise HTTPException(status_code=400, detail="Order is already closed.")

        if not order.kitchen_id:
            raise HTTPException(status_code=400, detail="Order is not linked to a kitchen.")

        # -------------------------
        # 2) compute totals & create sale
        # -------------------------
        total = sum(float(item.total_price or 0) for item in order.items)

        sale = restaurant_models.RestaurantSale(
            order_id=order.id,
            location_id=order.location_id,
            #kitchen_id=order.kitchen_id,
            guest_name=order.guest_name,
            served_by=served_by,
            total_amount=total,
            status="unpaid",
            served_at=datetime.utcnow()
        )
        db.add(sale)
        db.flush()  # get sale.id

        # -----------------------------------------
        # 3) create StoreIssue → KITCHEN
        # -----------------------------------------
        store_issue = store_models.StoreIssue(
            issue_to="kitchen",
            kitchen_id=order.kitchen_id,   # ✅ CORRECT
            issued_by_id=current_user.id,
            issue_date=datetime.utcnow()
        )
        db.add(store_issue)
        db.flush()

        # -----------------------------------------
        # 4) deduct stock (FIFO)
        # -----------------------------------------
        for item in order.items:
            store_item = (
                db.query(store_models.StoreItem)
                .filter(store_models.StoreItem.id == item.store_item_id)
                .first()
            )

            if not store_item:
                continue

            qty_to_deduct = float(item.store_qty_used or item.quantity or 0)
            if qty_to_deduct <= 0:
                continue

            stock_entries = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.item_id == store_item.id,
                    store_models.StoreStockEntry.quantity > 0
                )
                .order_by(
                    store_models.StoreStockEntry.purchase_date.asc(),
                    store_models.StoreStockEntry.id.asc()
                )
                .with_for_update()
                .all()
            )

            remaining = qty_to_deduct

            for entry in stock_entries:
                if remaining <= 0:
                    break

                available = float(entry.quantity or 0)
                if available <= 0:
                    continue

                if available >= remaining:
                    issued_qty = remaining
                    entry.quantity = available - remaining
                    remaining = 0
                else:
                    issued_qty = available
                    entry.quantity = 0
                    remaining -= available

                db.add(
                    store_models.StoreIssueItem(
                        issue_id=store_issue.id,
                        item_id=store_item.id,
                        quantity=issued_qty
                    )
                )

            # optional insufficient stock handling
            if remaining > 0:
                pass

        # -------------------------
        # 5) close order
        # -------------------------
        order.status = "closed"
        db.commit()

        db.refresh(sale)

        # -------------------------
        # 6) response
        # -------------------------
        items = [
            restaurant_schemas.MealOrderItemDisplay.from_orm(item)
            for item in order.items
        ]

        amount_paid = sum(p.amount for p in sale.payments) if sale.payments else 0
        balance = (sale.total_amount or 0) - amount_paid

        return restaurant_schemas.RestaurantSaleDisplay(
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

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not create sale from order: {str(e)}"
        )


@router.get("/open")
def list_open_meal_orders(
    location_id: Optional[int] = Query(None, description="Filter open orders by location id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    """
    Return open meal orders.

    If location_id is provided, restrict to that location.
    Returns an object with total_entries, total_amount and orders.
    """

    query = db.query(restaurant_models.MealOrder).filter(
        restaurant_models.MealOrder.status == "open"
    )

    if location_id is not None:
        query = query.filter(restaurant_models.MealOrder.location_id == location_id)

    orders = query.order_by(restaurant_models.MealOrder.id.asc()).all()

    result = []
    total_amount = 0.0

    for order in orders:
        order_items = []

        for item in order.items:

            # meal_id support (optional)
            meal = None
            if item.meal_id:
                meal = (
                    db.query(restaurant_models.Meal)
                    .filter(restaurant_models.Meal.id == item.meal_id)
                    .first()
                )

            # Price now comes from store item
            item_total = float(item.total_price or 0)
            total_amount += item_total

            order_items.append(
                restaurant_schemas.MealOrderItemDisplay(
                    id=item.id,
                    meal_id=item.meal_id,
                    meal_name=meal.name if meal else None,
                    store_item_id=item.store_item_id,
                    item_name=item.item_name,
                    quantity=item.quantity,
                    price_per_unit=item.price_per_unit,
                    total_price=item_total,
                    store_qty_used=item.store_qty_used,
                )
            )

        result.append(
            restaurant_schemas.MealOrderDisplay(
                id=order.id,

                # ✅ REQUIRED BY NEW SCHEMA
                location_id=order.location_id,
                kitchen_id=order.kitchen_id,

                # ✅ OPTIONAL (but very useful for frontend)
                location_name=order.location.name if order.location else None,
                kitchen_name=order.kitchen.name if order.kitchen else None,

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



@router.delete("/meal-orders/{order_id}", response_model=dict)
def delete_meal_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # 1️⃣ Fetch the order
    order = db.query(MealOrder).filter(MealOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Meal order not found")

    # 2️⃣ Prevent deletion if order is not open
    if order.status != "open":
        return {"detail": "Meal order cannot be deleted because it has been converted to a sale"}

    # 3️⃣ Delete the order (items will cascade)
    db.delete(order)
    db.commit()

    return {"detail": "Meal order deleted successfully"}




