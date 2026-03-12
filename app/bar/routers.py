from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import aliased
from typing import Optional, List
from sqlalchemy import and_
from datetime import datetime, date
from app.database import get_db
from app.users.auth import get_current_user
from app.users import schemas as user_schemas
from app.bar import models as bar_models, schemas as bar_schemas
from app.store import models as store_models
from app.bar.models import Bar, BarInventory, BarSale, BarSaleItem
from app.users.models import User
from app.users.permissions import role_required  # 👈 permission helper
from app.bar.models import Bar, BarInventoryReceipt
from typing import Optional
from datetime import timedelta
from app.barpayment import models as barpayment_models

from app.store.models import StoreItem
from app.bar.schemas import BarStockReceiveCreate, BarInventoryDisplay, BarItemSummarySchema, BarItemSummaryResponse
from datetime import datetime
from app.bar.schemas import  BarInventoryReceiptDisplay  # <- New response schema

from app.users.models import User
from app.bar.models import BarInventory, BarInventoryAdjustment
from app.bar.schemas import BarInventoryAdjustmentCreate, BarInventoryAdjustmentDisplay



from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.db import db_dependency
from app.core.business import resolve_business_id

from sqlalchemy.orm import selectinload

from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions






router = APIRouter()



WAT = ZoneInfo("Africa/Lagos")  # Africa/Lagos timezone for consistent timestamps

def now_wat() -> datetime:
    """Return current time in Africa/Lagos as timezone-aware datetime"""
    return datetime.now(WAT)


# ----------------------------
# Create Bar
# ----------------------------
@router.post("/bars", response_model=bar_schemas.BarDisplay)
def create_bar(
    bar: bar_schemas.BarCreate,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "admin"]))
):
    # Determine business scope
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    # Check for duplicate bar name within the same business
    existing = (
        db.query(bar_models.Bar)
        .filter_by(name=bar.name, business_id=effective_business_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bar name already exists")

    # Create bar with business_id and timestamp
    new_bar = bar_models.Bar(
        **bar.dict(),
        business_id=effective_business_id,
        created_at=now_wat()
    )
    db.add(new_bar)
    db.commit()
    db.refresh(new_bar)
    return new_bar


# ----------------------------
# List Bars (full)
# ----------------------------
@router.get("/bars", response_model=List[bar_schemas.BarDisplay])
def list_bars(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "admin"]))
):
    # Determine business scope
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    return (
        db.query(bar_models.Bar)
        .filter_by(business_id=effective_business_id)
        .order_by(bar_models.Bar.id.asc())
        .all()
    )


# ----------------------------
# List Bars (simple)
# ----------------------------
@router.get("/bars/simple", response_model=List[bar_schemas.BarDisplaySimple])
def list_bars_simple(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "admin"]))
):
    # Determine business scope
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    return (
        db.query(bar_models.Bar)
        .filter_by(business_id=effective_business_id)
        .order_by(bar_models.Bar.id.asc())
        .all()
    )



# ----------------------------
# BAR INVENTORY (Multi-Tenant)
# ----------------------------


# ----------------------------
# Update Bar
# ----------------------------
@router.put("/bars/{bar_id}", response_model=bar_schemas.BarDisplay)
def update_bar(
    bar_id: int,
    bar_update: bar_schemas.BarCreate,
    business_id: Optional[int] = Query(None, description="Required for super admin"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "super_admin"]))
):
    # For super admin, ensure business_id is provided
    if "super_admin" in current_user.roles and not business_id:
        raise HTTPException(status_code=400, detail="Super admin must provide business_id")

    resolved_business_id = resolve_business_id(current_user, business_id)

    bar = db.query(bar_models.Bar).filter_by(id=bar_id, business_id=resolved_business_id).first()
    if not bar:
        raise HTTPException(status_code=404, detail="Bar not found")

    # Ensure unique bar name within the business
    existing = db.query(bar_models.Bar).filter(
        bar_models.Bar.name == bar_update.name,
        bar_models.Bar.id != bar_id,
        bar_models.Bar.business_id == resolved_business_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bar name already exists for this business")

    for field, value in bar_update.dict().items():
        setattr(bar, field, value)

    db.commit()
    db.refresh(bar)
    return bar


# ----------------------------
# Delete Bar (Multi-Tenant)
# ----------------------------

# Inside bar_router
@router.delete("/{bar_id}")
def delete_bar(
    bar_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin", "super_admin"]))
):
    # resolve business
    roles = [r.lower() for r in current_user.roles]
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
    else:
        effective_business_id = current_user.business_id

    bar = db.query(bar_models.Bar).filter(
        bar_models.Bar.id == bar_id,
        bar_models.Bar.business_id == effective_business_id
    ).first()

    if not bar:
        raise HTTPException(status_code=404, detail="Bar not found")

    db.delete(bar)
    db.commit()

    return {
        "message": "Bar deleted successfully",
        "bar_id": bar_id,
        "business_id": effective_business_id
    }


""""

@router.post("/receive-stock", response_model=BarInventoryReceiptDisplay)
def receive_bar_stock(data: BarStockReceiveCreate, db: Session = Depends(get_db)):
    # Validate bar and item
    bar = db.query(Bar).filter(Bar.id == data.bar_id).first()
    if not bar:
        raise HTTPException(status_code=404, detail="Bar not found")

    item = db.query(StoreItem).filter(StoreItem.id == data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update or create inventory
    inventory = db.query(BarInventory).filter(
        BarInventory.bar_id == data.bar_id,
        BarInventory.item_id == data.item_id
    ).first()

    if inventory:
        inventory.quantity += data.quantity
        inventory.selling_price = data.selling_price
        inventory.note = data.note
    else:
        inventory = BarInventory(
            bar_id=data.bar_id,
            bar_name=bar.name,
            item_id=data.item_id,
            item_name=item.name,
            quantity=data.quantity,
            selling_price=data.selling_price,
            note=data.note
        )
        db.add(inventory)

    # Create receipt log
    receipt = BarInventoryReceipt(
        bar_id=data.bar_id,
        bar_name=bar.name,
        item_id=data.item_id,
        item_name=item.name,
        quantity=data.quantity,
        selling_price=data.selling_price,
        note=data.note,
        created_by="fcn"
    )
    db.add(receipt)

    db.commit()
    db.refresh(receipt)

    return receipt



@router.get("/received-stocks", response_model=List[BarInventoryDisplay])
def list_received_stocks(
    bar_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(BarInventoryReceipt)

    filters = []
    if bar_id:
        filters.append(BarInventoryReceipt.bar_id == bar_id)
    if start_date:
        filters.append(BarInventoryReceipt.created_at >= start_date)
    if end_date:
        filters.append(BarInventoryReceipt.created_at <= end_date)

    if filters:
        query = query.filter(and_(*filters))

    receipts = query.order_by(BarInventoryReceipt.created_at.desc()).all()
    return receipts


@router.put("/update-received-stock", response_model=bar_schemas.BarInventoryDisplay)
def update_received_stock(data: bar_schemas.BarStockUpdate, db: Session = Depends(get_db)):
    # Validate bar
    bar = db.query(Bar).filter(Bar.id == data.bar_id).first()
    if not bar:
        raise HTTPException(status_code=404, detail="Bar not found")

    # Validate item
    item = db.query(StoreItem).filter(StoreItem.id == data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Find the inventory record
    inventory = db.query(BarInventory).filter(
        BarInventory.bar_id == data.bar_id,
        BarInventory.item_id == data.item_id
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found for update")

    # Update fields
    inventory.quantity = data.new_quantity
    if data.selling_price is not None:
        inventory.selling_price = data.selling_price
    if data.note is not None:
        inventory.note = data.note

    db.commit()
    db.refresh(inventory)

    return inventory


@router.delete("/bar-inventory/{inventory_id}", status_code=204)
def delete_bar_inventory(inventory_id: int, db: Session = Depends(get_db),
      current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))                   
    ):
    inventory = db.query(BarInventory).filter(BarInventory.id == inventory_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    db.delete(inventory)
    db.commit()
    return {"message": "Inventory entry deleted successfully"}

    """""""""


# ----------------------------
# Get Bar Items (Simple) - Multi-Tenant
# ----------------------------
@router.get("/items/simple", response_model=List[bar_schemas.BarSaleItemSummary])
def get_bar_items(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar","admin","super_admin"]))
):
    # ------------------------------
    # Resolve business
    # ------------------------------
    roles = [r.lower() for r in current_user.roles]

    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Subquery (latest inventory)
    # ------------------------------
    subquery = (
        db.query(
            bar_models.BarInventory.item_id,
            func.max(bar_models.BarInventory.id).label("latest_inventory_id")
        )
        .filter(bar_models.BarInventory.business_id == effective_business_id)
        .group_by(bar_models.BarInventory.item_id)
        .subquery()
    )

    # ------------------------------
    # Get items
    # ------------------------------
    items = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.item_type.label("item_type"),
            bar_models.BarInventory.selling_price.label("selling_price"),
        )
        .outerjoin(subquery, subquery.c.item_id == store_models.StoreItem.id)
        .outerjoin(bar_models.BarInventory, bar_models.BarInventory.id == subquery.c.latest_inventory_id)
        .filter(
            store_models.StoreItem.item_type == "bar",
            store_models.StoreItem.business_id == effective_business_id
        )
        .all()
    )

    result = [
        bar_schemas.BarSaleItemSummary(
            item_id=item.item_id,
            item_name=item.item_name,
            selling_price=item.selling_price or 0,
            quantity=0,
            total_amount=0
        )
        for item in items
    ]

    return result



# ----------------------------
# Get Bar Items (Simple Sell Price) - Multi-Tenant
# ----------------------------
@router.get("/items/simplesellprice", response_model=List[bar_schemas.BarSaleItemSummary])
def get_bar_items(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar","admin","super_admin"]))
):
    """
    Return all bar items with their selling_price from store_items table.
    """

    # ------------------------------
    # Resolve business
    # ------------------------------
    roles = [r.lower() for r in current_user.roles]

    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Query items
    # ------------------------------
    items = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.item_type.label("item_type"),
            store_models.StoreItem.selling_price.label("selling_price"),
        )
        .filter(
            store_models.StoreItem.item_type == "bar",
            store_models.StoreItem.business_id == effective_business_id
        )
        .all()
    )

    result = [
        bar_schemas.BarSaleItemSummary(
            item_id=item.item_id,
            item_name=item.item_name,
            selling_price=float(item.selling_price or 0),
            quantity=0,
            total_amount=0
        )
        for item in items
    ]

    return result



# ----------------------------
# Update Bar Item Selling Price (Multi-Tenant)
# ----------------------------
# ----------------------------
# Update Bar Item Selling Price (Multi-Tenant)
# ----------------------------
@router.put("/inventory/set-price", response_model=bar_schemas.BarInventoryDisplay)
def update_selling_price(
    data: bar_schemas.BarPriceUpdate,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "admin", "super_admin"]))
):

    # ------------------------------
    # Resolve business
    # ------------------------------
    roles = [r.lower() for r in current_user.roles]

    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Find existing inventory record
    # ------------------------------
    bar_item = db.query(bar_models.BarInventory).filter(
        bar_models.BarInventory.bar_id == data.bar_id,
        bar_models.BarInventory.item_id == data.item_id,
        bar_models.BarInventory.business_id == effective_business_id
    ).first()

    if bar_item:
        # Update price
        bar_item.selling_price = data.new_price
    else:
        # Create new record
        bar_item = bar_models.BarInventory(
            bar_id=data.bar_id,
            item_id=data.item_id,
            selling_price=data.new_price,
            quantity=0,
            business_id=effective_business_id
        )
        db.add(bar_item)

    db.commit()
    db.refresh(bar_item)

    # ------------------------------
    # Fetch item and bar names
    # ------------------------------
    item = db.query(store_models.StoreItem).filter(
        store_models.StoreItem.id == bar_item.item_id
    ).first()

    bar = db.query(bar_models.Bar).filter(
        bar_models.Bar.id == bar_item.bar_id
    ).first()

    # ------------------------------
    # Return response
    # ------------------------------
    return {
        "id": bar_item.id,
        "item_id": bar_item.item_id,
        "item_name": item.name if item else None,
        "bar_id": bar_item.bar_id,
        "bar_name": bar.name if bar else None,
        "quantity": bar_item.quantity,
        "selling_price": bar_item.selling_price,
        "received_at": bar_item.received_at,
        "note": bar_item.note
    }




# ----------------------------
# BAR SALES
# ----------------------------

from app.store import models as store_models   # 👈 add this import
from datetime import datetime, timezone


@router.post("/sales", response_model=bar_schemas.BarSaleDisplay)
def create_bar_sale(
    sale_data: bar_schemas.BarSaleCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    try:
        total_amount = 0.0

        # -------------------------------------------------
        # 0. Validate Sale Date (NO FUTURE SALES)
        # -------------------------------------------------
        sale_date = sale_data.sale_date

        # If frontend sends naive datetime, assume UTC
        if sale_date.tzinfo is None:
            sale_date = sale_date.replace(tzinfo=timezone.utc)

        now_utc = datetime.now(timezone.utc)

        if sale_date > now_utc:
            raise HTTPException(
                status_code=400,
                detail="Sale date cannot be in the future."
            )


        # -------------------------------------------------
        # 1. Create Sale (UNPAID by default)
        # -------------------------------------------------
        sale = bar_models.BarSale(
            bar_id=sale_data.bar_id,
            sale_date=sale_data.sale_date,  # ✅ USER-PROVIDED DATE
            created_by_id=current_user.id,
            status="unpaid"
        )
        db.add(sale)
        db.flush()  # assigns sale.id

        sale_items_response = []

        # -------------------------------------------------
        # 2. Process Sale Items
        # -------------------------------------------------
        for item_data in sale_data.items:

            # 🔹 Fetch inventory + related store item
            inventory = (
                db.query(bar_models.BarInventory)
                .options(joinedload(bar_models.BarInventory.item))
                .filter_by(
                    bar_id=sale_data.bar_id,
                    item_id=item_data.item_id
                )
                .first()
            )

            if not inventory:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Item ID {item_data.item_id} not found in bar inventory."
                )

            store_item = inventory.item
            if not store_item or store_item.item_type != "bar":
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"{store_item.name if store_item else 'Item'} is not a bar item."
                )

            if inventory.quantity < item_data.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Not enough {store_item.name} in stock "
                        f"(requested: {item_data.quantity}, available: {inventory.quantity})."
                    )
                )

            # 🔹 Selling price must come from frontend
            if item_data.selling_price is None or item_data.selling_price <= 0:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Selling price must be provided for {store_item.name}."
                )

            selling_price = item_data.selling_price

            # 🔹 Selling price must come from frontend
            if item_data.selling_price is None or item_data.selling_price <= 0:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Selling price must be provided for {store_item.name}."
                )

            selling_price = item_data.selling_price

            # Optional: populate catalog price if missing
            if not store_item.selling_price or store_item.selling_price <= 0:
                store_item.selling_price = selling_price


            # 🔹 Deduct stock
            inventory.quantity -= item_data.quantity

            # 🔹 Calculate totals
            item_total = selling_price * item_data.quantity
            total_amount += item_total

            # 🔹 Save sale item
            sale_item = bar_models.BarSaleItem(
                sale_id=sale.id,
                bar_inventory_id=inventory.id,
                quantity=item_data.quantity,
                selling_price=selling_price,
                total_amount=item_total
            )
            db.add(sale_item)
            db.flush()

            # 🔹 Prepare response item
            sale_items_response.append(
                bar_schemas.BarSaleItemSummary(
                    item_id=store_item.id,
                    item_name=store_item.name,
                    quantity=item_data.quantity,
                    selling_price=selling_price,
                    total_amount=item_total
                )
            )

        # -------------------------------------------------
        # 3. Finalize Sale
        # -------------------------------------------------
        sale.total_amount = total_amount
        db.commit()
        db.refresh(sale)

        # -------------------------------------------------
        # 4. Return Response
        # -------------------------------------------------
        return bar_schemas.BarSaleDisplay(
            id=sale.id,
            sale_date=sale.sale_date,
            bar_id=sale.bar_id,
            bar_name=sale.bar.name if sale.bar else "",
            created_by=current_user.username,
            status=sale.status,
            total_amount=total_amount,
            sale_items=sale_items_response
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales", response_model=bar_schemas.BarSaleListResponse)
def list_bar_sales(
    bar_id: Optional[int] = None,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    # -------------------------------------------------
    # 1. Base Query (FULL eager loading)
    # -------------------------------------------------
    query = db.query(BarSale).options(
        joinedload(BarSale.bar),
        joinedload(BarSale.created_by_user),
        joinedload(BarSale.sale_items)
            .joinedload(BarSaleItem.bar_inventory)
            .joinedload(BarInventory.item)
    )

    # -------------------------------------------------
    # 2. Filters
    # -------------------------------------------------
    if bar_id:
        query = query.filter(BarSale.bar_id == bar_id)

    # 🔥 Use USER-PROVIDED sale_date (same logic as create)
    if start_date and end_date:
        query = query.filter(
            func.date(BarSale.sale_date).between(start_date, end_date)
        )
    elif start_date:
        query = query.filter(
            func.date(BarSale.sale_date) >= start_date
        )
    elif end_date:
        query = query.filter(
            func.date(BarSale.sale_date) <= end_date
        )

    # -------------------------------------------------
    # 3. Order
    # -------------------------------------------------
    query = query.order_by(BarSale.sale_date.desc())
    sales = query.all()

    # -------------------------------------------------
    # 4. Build Response
    # -------------------------------------------------
    results = []
    total_sales_amount = 0.0

    for sale in sales:
        sale_items = []
        sale_total = 0.0

        for s_item in sale.sale_items:
            inv = s_item.bar_inventory
            store_item = inv.item if inv else None

            item_name = store_item.name if store_item else "Unknown"
            item_id = inv.item_id if inv else None

            selling_price = float(s_item.selling_price or 0.0)
            total_amount = float(s_item.total_amount or 0.0)

            sale_items.append({
                "item_id": item_id,
                "item_name": item_name,
                "quantity": int(s_item.quantity or 0),
                "selling_price": selling_price,   # ✅ from sale record
                "total_amount": total_amount,
            })

            sale_total += total_amount

        results.append({
            "id": sale.id,
            "sale_date": sale.sale_date,  # ✅ SAME FIELD AS CREATE
            "bar_id": sale.bar_id,
            "bar_name": sale.bar.name if sale.bar else "",
            "created_by": sale.created_by_user.username if sale.created_by_user else "",
            "status": sale.status,
            "total_amount": sale_total,
            "sale_items": sale_items,
        })

        total_sales_amount += sale_total

    # -------------------------------------------------
    # 5. Final Response
    # -------------------------------------------------
    return {
        "total_entries": len(results),
        "total_sales_amount": total_sales_amount,
        "sales": results,
    }


@router.get("/item-summary", response_model=BarItemSummaryResponse)
def get_bar_item_summary(
    bar_id: Optional[int] = Query(None, description="Filter by Bar ID"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    try:
        query = (
            db.query(
                store_models.StoreItem.id.label("item_id"),
                store_models.StoreItem.name.label("item_name"),
                func.sum(bar_models.BarSaleItem.quantity).label("total_quantity"),
                func.avg(bar_models.BarSaleItem.selling_price).label("selling_price"),
                func.sum(bar_models.BarSaleItem.total_amount).label("total_amount"),
            )
            .join(bar_models.BarInventory, bar_models.BarInventory.item_id == store_models.StoreItem.id)
            .join(bar_models.BarSaleItem, bar_models.BarSaleItem.bar_inventory_id == bar_models.BarInventory.id)
            .join(bar_models.BarSale, bar_models.BarSale.id == bar_models.BarSaleItem.sale_id)
        )

        # Bar filter if provided
        if bar_id:
            query = query.filter(bar_models.BarSale.bar_id == bar_id)

        # Date filters only apply if provided (empty params mean no date restriction)
        if start_date and end_date:
            query = query.filter(func.date(bar_models.BarSale.sale_date).between(start_date, end_date))
        elif start_date:
            query = query.filter(func.date(bar_models.BarSale.sale_date) >= start_date)
        elif end_date:
            query = query.filter(func.date(bar_models.BarSale.sale_date) <= end_date)

        query = query.group_by(store_models.StoreItem.id, store_models.StoreItem.name)

        results = query.all()

        # Convert results to primitive dicts (Pydantic will also validate for response_model)
        items = []
        for row in results:
            items.append({
                "item_id": int(row.item_id),
                "item_name": row.item_name,
                "total_quantity": int(row.total_quantity or 0),
                "selling_price": float(row.selling_price or 0.0),
                "total_amount": float(row.total_amount or 0.0),
            })

        grand_total = sum(it["total_amount"] for it in items)

        # optional: uncomment to debug server logs when testing
        # print("DEBUG /bar/item-summary ->", {"items_len": len(items), "grand_total": grand_total})

        return {"items": items, "grand_total": grand_total}

    except Exception as e:
        # log server-side error for easier debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    


@router.get("/unpaid_sales", response_model=bar_schemas.BarSaleListResponse)
def list_unpaid_sales(
    bar_id: Optional[int] = None,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    query = db.query(bar_models.BarSale).options(
        joinedload(bar_models.BarSale.bar),
        joinedload(bar_models.BarSale.created_by_user),
        joinedload(bar_models.BarSale.sale_items)
            .joinedload(bar_models.BarSaleItem.bar_inventory)
            .joinedload(bar_models.BarInventory.item)
    )

    if bar_id:
        query = query.filter(bar_models.BarSale.bar_id == bar_id)

    if start_date and end_date:
        query = query.filter(func.date(bar_models.BarSale.sale_date).between(start_date, end_date))
    elif start_date:
        query = query.filter(func.date(bar_models.BarSale.sale_date) >= start_date)
    elif end_date:
        query = query.filter(func.date(bar_models.BarSale.sale_date) <= end_date)

    query = query.order_by(bar_models.BarSale.sale_date.desc())
    sales = query.all()

    results = []
    total_sales_amount = 0.0

    for sale in sales:
        # ✅ Calculate total paid for this sale
        total_paid = (
            db.query(func.coalesce(func.sum(barpayment_models.BarPayment.amount_paid), 0))
            .filter(
                barpayment_models.BarPayment.bar_sale_id == sale.id,
                barpayment_models.BarPayment.status == "active"
            )
            .scalar()
        )

        if total_paid >= sale.total_amount:
            # fully paid → skip
            continue

        sale_items = []
        sale_total = 0.0

        for s_item in sale.sale_items:
            inv = s_item.bar_inventory
            store_item = inv.item if inv else None
            item_name = store_item.name if store_item else "Unknown"
            item_id = inv.item_id if inv else None
            selling_price = float(s_item.selling_price or 0.0)

            sale_items.append({
                "item_id": item_id,
                "item_name": item_name,
                "quantity": int(s_item.quantity or 0),
                "selling_price": selling_price,
                "total_amount": float(s_item.total_amount or 0.0),
            })

            sale_total += float(s_item.total_amount or 0.0)

        # determine payment status
        if total_paid == 0:
            status = "unpaid"
        else:
            status = "part payment"

        results.append({
            "id": sale.id,
            "sale_date": sale.sale_date,
            "bar_id": sale.bar_id,
            "bar_name": sale.bar.name if sale.bar else "",
            "created_by": sale.created_by_user.username if sale.created_by_user else "",
            "status": status,  # override here
            "total_amount": sale_total,
            "sale_items": sale_items,
        })

        total_sales_amount += sale_total

    return {
        "total_entries": len(results),
        "total_sales_amount": total_sales_amount,
        "sales": results,
    }

from sqlalchemy import func
from sqlalchemy.orm import joinedload

@router.put("/sales/{sale_id}", response_model=bar_schemas.BarSaleDisplay)
def update_bar_sale(
    sale_id: int,
    sale_data: bar_schemas.BarSaleCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    sale = db.query(bar_models.BarSale).filter_by(id=sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale.bar_id != sale_data.bar_id:
        raise HTTPException(status_code=400, detail="Bar ID mismatch")

    # ==========================================================
    # 🚫 Restrict future date edits
    # ==========================================================
    if sale_data.sale_date:
        incoming_date = sale_data.sale_date

        # Normalize to UTC for safe comparison
        now = datetime.now(timezone.utc)

        if incoming_date > now:
            raise HTTPException(
                status_code=400,
                detail="Sale date cannot be set to a future date"
            )

        sale.sale_date = incoming_date


    # ==========================================================
    # ✅ FIX: Always update sale_date from payload
    # ==========================================================
    if sale_data.sale_date:
        sale.sale_date = sale_data.sale_date
    elif not sale.sale_date:
        # fallback for legacy rows
        sale.sale_date = datetime.utcnow()

    try:
        # ======================================================
        # 1️⃣ Existing reserved quantities
        # ======================================================
        existing_items = {}
        for si in sale.sale_items:
            iid = si.bar_inventory.item_id
            existing_items[iid] = existing_items.get(iid, 0) + int(si.quantity)

        # ======================================================
        # 2️⃣ Requested quantities (payload)
        # ======================================================
        requested_items = {}
        payload_price_map = {}

        for it in sale_data.items:
            if not it.item_id:
                raise HTTPException(status_code=400, detail="Every item must have an item_id")

            qty = int(it.quantity or 0)
            requested_items[it.item_id] = requested_items.get(it.item_id, 0) + qty

            # ✅ Selling price comes ONLY from payload (user-adjustable)
            payload_price_map[it.item_id] = float(it.selling_price or 0.0)

        all_item_ids = set(existing_items.keys()) | set(requested_items.keys())

        # ======================================================
        # 3️⃣ Lock inventories
        # ======================================================
        inventories = {}
        for iid in all_item_ids:
            inv = (
                db.query(bar_models.BarInventory)
                .filter_by(bar_id=sale.bar_id, item_id=iid)
                .with_for_update()
                .first()
            )
            if not inv:
                raise HTTPException(status_code=404, detail=f"Inventory not found for item {iid}")
            inventories[iid] = inv

        # ======================================================
        # 4️⃣ Validate availability
        # ======================================================
        for iid in all_item_ids:
            inv = inventories[iid]
            original_qty = existing_items.get(iid, 0)
            requested_qty = requested_items.get(iid, 0)

            available_total = inv.quantity + original_qty
            if requested_qty > available_total:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Not enough stock for '{inv.item.name}' "
                        f"(requested {requested_qty}, available {available_total})"
                    )
                )

        # ======================================================
        # 5️⃣ Apply inventory & sale item changes
        # ======================================================
        sale_items_by_item = {}
        for si in sale.sale_items:
            iid = si.bar_inventory.item_id
            sale_items_by_item.setdefault(iid, []).append(si)

        for iid in all_item_ids:
            inv = inventories[iid]
            original_qty = existing_items.get(iid, 0)
            requested_qty = requested_items.get(iid, 0)

            # Restore + re-deduct
            inv.quantity = (inv.quantity + original_qty) - requested_qty

            # Remove old sale items
            for si in sale_items_by_item.get(iid, []):
                db.delete(si)

            # Add new sale items
            if requested_qty > 0:
                price = payload_price_map.get(iid, 0.0)

                db.add(bar_models.BarSaleItem(
                    sale_id=sale.id,
                    bar_inventory_id=inv.id,
                    quantity=requested_qty,
                    selling_price=price,
                    total_amount=price * requested_qty
                ))

        db.flush()

        # ======================================================
        # 6️⃣ Recalculate sale total
        # ======================================================
        sale.total_amount = (
            db.query(func.sum(bar_models.BarSaleItem.total_amount))
            .filter(bar_models.BarSaleItem.sale_id == sale.id)
            .scalar()
        ) or 0.0

        db.commit()
        db.refresh(sale)

        # ======================================================
        # 7️⃣ Reload for response
        # ======================================================
        sale = (
            db.query(bar_models.BarSale)
            .options(
                joinedload(bar_models.BarSale.bar),
                joinedload(bar_models.BarSale.created_by_user),
                joinedload(bar_models.BarSale.sale_items)
                    .joinedload(bar_models.BarSaleItem.bar_inventory)
                    .joinedload(bar_models.BarInventory.item)
            )
            .get(sale.id)
        )

        sale_items = [
            bar_schemas.BarSaleItemSummary(
                item_id=item.bar_inventory.item_id,
                item_name=item.bar_inventory.item.name,
                quantity=item.quantity,
                selling_price=item.selling_price,
                total_amount=item.total_amount
            )
            for item in sale.sale_items
        ]

        return bar_schemas.BarSaleDisplay(
            id=sale.id,
            sale_date=sale.sale_date,  # ✅ always updated
            bar_id=sale.bar_id,
            bar_name=sale.bar.name if sale.bar else "",
            created_by=sale.created_by_user.username if sale.created_by_user else "",
            status=sale.status,
            total_amount=sale.total_amount,
            sale_items=sale_items
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sales/{sale_id}")
def delete_bar_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # ✅ Only admin can delete
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admin can delete sales")

    sale = db.query(bar_models.BarSale).filter_by(id=sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    db.delete(sale)
    db.commit()
    return {"detail": "Bar sale deleted successfully"}






@router.get("/stock-balance", response_model=List[bar_schemas.BarStockBalance])
def get_bar_stock_balance(
    bar_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar", "admin"]))
):
    try:
        # Ensure bar_id is int
        if bar_id:
            try:
                bar_id = int(bar_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid bar_id")

        # Step 1: Issued items
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.bar_id.label("bar_id"),
                func.sum(store_models.StoreIssueItem.quantity).label("total_received")
            )
            .join(store_models.StoreIssue)
        )

        if bar_id:
            issued_query = issued_query.filter(store_models.StoreIssue.bar_id == bar_id)
        if start_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issued_at >= start_date)
        if end_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issued_at <= end_date)

        issued_query = issued_query.group_by(store_models.StoreIssueItem.item_id, store_models.StoreIssue.bar_id)
        issued_data = {(row.item_id, row.bar_id): row.total_received for row in issued_query.all()}

        # Step 2: Sold items
        sold_query = (
            db.query(
                bar_models.BarInventory.item_id,
                bar_models.BarSale.bar_id,
                func.sum(bar_models.BarSaleItem.quantity).label("total_sold")
            )
            .join(bar_models.BarSaleItem.bar_inventory)
            .join(bar_models.BarSaleItem.sale)
        )

        if bar_id:
            sold_query = sold_query.filter(bar_models.BarSale.bar_id == bar_id)
        if start_date:
            sold_query = sold_query.filter(bar_models.BarSale.sale_date >= start_date)
        if end_date:
            sold_query = sold_query.filter(bar_models.BarSale.sale_date <= end_date)

        sold_query = sold_query.group_by(bar_models.BarInventory.item_id, bar_models.BarSale.bar_id)
        sold_data = {(row.item_id, row.bar_id): row.total_sold for row in sold_query.all()}

        # Step 3: Adjusted items
        adjusted_query = db.query(
            bar_models.BarInventoryAdjustment.item_id,
            bar_models.BarInventoryAdjustment.bar_id,
            func.sum(bar_models.BarInventoryAdjustment.quantity_adjusted).label("total_adjusted")
        )

        if bar_id:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.bar_id == bar_id)
        if start_date:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.adjusted_at >= start_date)
        if end_date:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.adjusted_at <= end_date)

        adjusted_query = adjusted_query.group_by(bar_models.BarInventoryAdjustment.item_id, bar_models.BarInventoryAdjustment.bar_id)
        adjusted_data = {(row.item_id, row.bar_id): row.total_adjusted for row in adjusted_query.all()}

        # Step 4: Merge all keys
        all_keys = set(issued_data.keys()) | set(sold_data.keys()) | set(adjusted_data.keys())
        results = []

        for (item_id, b_id) in all_keys:
            if b_id is None:
                continue

            issued = issued_data.get((item_id, b_id), 0)
            sold = sold_data.get((item_id, b_id), 0)
            adjusted = adjusted_data.get((item_id, b_id), 0)
            balance = issued - sold - adjusted

            # Use db.get for SQLAlchemy 2.x safe fetch
            item = db.get(store_models.StoreItem, item_id)
            bar = db.get(bar_models.Bar, b_id)

            results.append(bar_schemas.BarStockBalance(
                bar_id=b_id,
                bar_name=bar.name if bar else "Unknown",
                item_id=item_id,
                item_name=item.name if item else "Unknown",
                category_name=item.category.name if item and item.category else "Uncategorized",
                item_type=item.item_type if item else "-",
                unit=item.unit if item else "-",
                total_received=issued,
                total_sold=sold,
                total_adjusted=adjusted,
                balance=balance
            ))

        return results

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stock balance: {str(e)}")

    


@router.post("/adjust", response_model=BarInventoryAdjustmentDisplay)
def adjust_bar_inventory(
    adjustment_data: BarInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # ✅ Only admins can adjust
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can adjust inventory.")

    # 🔍 Get existing inventory
    inventory = db.query(BarInventory).filter(
        BarInventory.bar_id == adjustment_data.bar_id,
        BarInventory.item_id == adjustment_data.item_id
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found.")

    if adjustment_data.quantity_adjusted > inventory.quantity:
        raise HTTPException(status_code=400, detail="Adjustment exceeds available stock.")

    # 🧮 Deduct from inventory
    inventory.quantity -= adjustment_data.quantity_adjusted
    db.add(inventory)

    # 📦 Create adjustment record
    adjustment = BarInventoryAdjustment(
        bar_id=adjustment_data.bar_id,
        item_id=adjustment_data.item_id,
        quantity_adjusted=adjustment_data.quantity_adjusted,
        reason=adjustment_data.reason,
        adjusted_by=current_user.username
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    return adjustment

@router.get("/adjustments", response_model=List[BarInventoryAdjustmentDisplay])
def list_bar_inventory_adjustments(
    bar_id: Optional[int] = None,
    item_id: Optional[int] = None,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    query = db.query(BarInventoryAdjustment)

    if bar_id:
        query = query.filter(BarInventoryAdjustment.bar_id == bar_id)
    if item_id:
        query = query.filter(BarInventoryAdjustment.item_id == item_id)
    if start_date:
        query = query.filter(BarInventoryAdjustment.adjusted_at >= start_date)
    if end_date:
        query = query.filter(BarInventoryAdjustment.adjusted_at <= end_date)

    adjustments = query.order_by(BarInventoryAdjustment.adjusted_at.desc()).all()
    return adjustments


@router.delete("/adjustments/{adjustment_id}", response_model=bar_schemas.BarInventoryAdjustmentDisplay)
def delete_bar_inventory_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # ✅ Only admins can delete
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can delete adjustments.")

    adjustment = db.query(BarInventoryAdjustment).get(adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found.")

    # 🔁 Restore quantity back to inventory
    inventory = db.query(BarInventory).filter(
        BarInventory.bar_id == adjustment.bar_id,
        BarInventory.item_id == adjustment.item_id
    ).first()

    if inventory:
        inventory.quantity += adjustment.quantity_adjusted
        db.add(inventory)

    db.delete(adjustment)
    db.commit()

    return adjustment




@router.delete("/bars/{bar_id}")
def delete_bar(
    bar_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    bar = db.query(bar_models.Bar).filter_by(id=bar_id).first()
    if not bar:
        raise HTTPException(status_code=404, detail="Bar not found")

    # Optional: Check if this bar has sales or inventory, and block deletion if necessary

    db.delete(bar)
    db.commit()
    return {"detail": "Bar deleted successfully"}



# ----------------------------
# RECEIVED ITEMS
# ----------------------------

from datetime import date

from datetime import date

@router.get("/store-issue-control", response_model=List[dict])
def get_store_items_received(
    bar_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    if bar_id:
        bar = db.query(Bar).filter(Bar.id == bar_id).first()
        if not bar:
            raise HTTPException(status_code=404, detail="Bar not found")

    subquery = (
        db.query(
            store_models.StoreStockEntry.item_id,
            store_models.StoreStockEntry.unit_price
        )
        .order_by(
            store_models.StoreStockEntry.item_id,
            store_models.StoreStockEntry.purchase_date.desc()
        )
        .distinct(store_models.StoreStockEntry.item_id)
        .subquery()
    )

    query = (
        db.query(
            store_models.StoreIssueItem.item_id,
            store_models.StoreItem.name,
            store_models.StoreItem.unit,
            store_models.StoreIssue.bar_id.label("bar_id"),
            store_models.StoreIssue.issue_date,
            store_models.StoreIssueItem.quantity,
            subquery.c.unit_price
        )
        .join(store_models.StoreIssue,
            store_models.StoreIssue.id == store_models.StoreIssueItem.issue_id)
        .join(store_models.StoreItem,
            store_models.StoreItem.id == store_models.StoreIssueItem.item_id)
        .outerjoin(subquery, subquery.c.item_id == store_models.StoreIssueItem.item_id)
        .filter(store_models.StoreItem.item_type == "bar")   # ✅ ONLY BAR ITEMS
    )

    

    if bar_id:
        query = query.filter(store_models.StoreIssue.bar_id == bar_id)


    if start_date:
        query = query.filter(store_models.StoreIssue.issue_date >= start_date)
    if end_date:
        query = query.filter(store_models.StoreIssue.issue_date < end_date + timedelta(days=1))

    results = query.all()

    return [
        {
            "item_id": r.item_id,
            "item_name": r.name,
            "unit": r.unit,
            "bar_id": r.bar_id,
            "issue_date": r.issue_date,
            "quantity": r.quantity,
            "unit_price": r.unit_price,
            "total_amount": round(r.quantity * r.unit_price, 2) if r.unit_price else None
        }
        for r in results
    ]



