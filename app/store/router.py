from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from typing import List
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from app.users.models import User
from app.users import schemas as user_schemas
from app.store import models as store_models
from app.restaurant import models as restaurant_models
from app.restaurant.models import MealOrder
from app.store import schemas as store_schemas
from app.bar.models import BarInventory 
from app.bar.models import Bar 

from app.store.schemas import IssueCreate, IssueDisplay
from app.kitchen.models import Kitchen, KitchenInventory
from app.kitchen import models as kitchen_models
from app.kitchen import schemas as kitchen_schemas
from app.kitchen.schemas import IssueToKitchenItemDisplay, KitchenDisplaySimple, IssueToKitchenDisplay, IssueToKitchenCreate, KitchenItemMinimalDisplay
from app.store.models import StoreIssue, StoreIssueItem, StoreStockEntry, StoreCategory, StoreItem
from app.vendor import models as vendor_models
from app.store.models import StoreInventoryAdjustment
from app.store.schemas import  StoreInventoryAdjustmentCreate, StoreItemDisplay

from app.bar import models as bar_models
from app.bar import schemas as bar_schemas

from app.business import models as business_models  # make sure business model is imported


from sqlalchemy.orm import aliased
from fastapi import Form
from sqlalchemy import desc, func

from fastapi import Query
from datetime import date

from sqlalchemy.orm import joinedload
from fastapi import File, UploadFile, Form
import os

from fastapi.responses import JSONResponse
import shutil

from app.core.db import db_dependency
#from app.users.auth import role_required
from app.core.business import resolve_business_id

from sqlalchemy.orm import selectinload

from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions

from zoneinfo import ZoneInfo

from fastapi import Query, Depends, HTTPException



router = APIRouter()

WAT = ZoneInfo("Africa/Lagos")

# ----------------------------
# CATEGORY ROUTES
# ----------------------------



# ----------------------------
# Create Category
# ----------------------------
@router.post("/categories", response_model=store_schemas.StoreCategoryDisplay)
def create_category(
    category: store_schemas.StoreCategoryCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    existing = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.name == category.name,
            store_models.StoreCategory.business_id == business_id
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")

    new_cat = store_models.StoreCategory(
        name=category.name,
        business_id=business_id
    )

    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    return new_cat


# ----------------------------
# List Categories
# ----------------------------
@router.get("/categories", response_model=list[store_schemas.StoreCategoryDisplay])
def list_categories(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    categories = (
        db.query(store_models.StoreCategory)
        .filter(store_models.StoreCategory.business_id == business_id)
        .all()
    )

    return categories


# ----------------------------
# Update Category
# ----------------------------
@router.put("/categories/{category_id}", response_model=store_schemas.StoreCategoryDisplay)
def update_category(
    category_id: int,
    update_data: store_schemas.StoreCategoryCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    category = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.id == category_id,
            store_models.StoreCategory.business_id == business_id
        )
        .first()
    )

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    existing = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.name == update_data.name,
            store_models.StoreCategory.business_id == business_id,
            store_models.StoreCategory.id != category_id
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    category.name = update_data.name

    db.commit()
    db.refresh(category)

    return category


# ----------------------------
# Delete Category
# ----------------------------
@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    category = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.id == category_id,
            store_models.StoreCategory.business_id == business_id
        )
        .first()
    )

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()

    return {"detail": "Category deleted successfully"}

# --------------------------------------------------
# Create Store Item
# --------------------------------------------------
@router.post("/items", response_model=store_schemas.StoreItemDisplay)
def create_item(
    item: store_schemas.StoreItemCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        existing = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.name == item.name,
                store_models.StoreItem.business_id == business_id
            )
            .first()
        )

        if existing:
            raise HTTPException(status_code=400, detail="Item already exists")

        new_item = store_models.StoreItem(
            **item.dict(),
            business_id=business_id
        )

        db.add(new_item)
        db.commit()
        db.refresh(new_item)

        return new_item

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


# --------------------------------------------------
# List Store Items
# --------------------------------------------------
@router.get("/items", response_model=list[store_schemas.StoreItemDisplay])
def list_items(
    category: Optional[str] = None,
    search: Optional[str] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price.label("latest_cost_price")
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(store_models.StoreItem.business_id == business_id)
        )

        if category:
            query = (
                query.join(store_models.StoreItem.category)
                .filter(store_models.StoreCategory.name == category)
            )

        if search:
            query = query.filter(
                store_models.StoreItem.name.ilike(f"%{search}%")
            )

        results = query.order_by(store_models.StoreItem.name.asc()).all()

        return [
            store_schemas.StoreItemDisplay(
                id=item.id,
                name=item.name,
                unit=item.unit,
                category=item.category,
                unit_price=latest_cost_price or 0.0,
                selling_price=item.selling_price or 0.0,
                created_at=item.created_at,
                item_type=item.item_type
            )
            for item, latest_cost_price in results
        ]

    except Exception as e:
        print("💥 Error:", e)
        raise HTTPException(status_code=500, detail=str(e))



# --------------------------------------------------
# List Store Items
# --------------------------------------------------
@router.get("/store-items")
def list_store_items(
    category: Optional[str] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant"]))
):

    business_id = resolve_business_id(current_user, business_id)

    query = db.query(store_models.StoreItem).filter(
        store_models.StoreItem.business_id == business_id
    )

    if category:
        query = query.join(store_models.StoreItem.category).filter(
            store_models.StoreCategory.name == category
        )

    return query.order_by(store_models.StoreItem.name.asc()).all()


# --------------------------------------------------
# Simple Item List
# --------------------------------------------------
@router.get("/items/simple", response_model=List[store_schemas.StoreItemOut])
def list_items_simple(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(store_models.StoreItem.business_id == business_id)
            .order_by(store_models.StoreItem.id.asc())
        )

        results = query.all()

        items = []
        for item, unit_price in results:
            items.append(
                store_schemas.StoreItemOut(
                    id=item.id,
                    name=item.name,
                    unit=item.unit,
                    unit_price=unit_price or 0.0,
                    selling_price=item.selling_price or 0.0,
                    category_id=item.category_id,
                    item_type=item.item_type
                )
            )

        return items

    except Exception as e:
        print("❌ Error in /items/simple:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch items.")
    


@router.get("/items/simple-search", response_model=List[store_schemas.StoreItemOut])
def list_items_simple_search(
    search: Optional[str] = None,
    limit: int = 50,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        # Subquery to get latest stock entry per item
        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(store_models.StoreItem.business_id == business_id)
        )

        # Optional search by name
        if search:
            query = query.filter(store_models.StoreItem.name.ilike(f"%{search}%"))

        results = (
            query
            .order_by(store_models.StoreItem.name.asc())
            .limit(limit)
            .all()
        )

        return [
            store_schemas.StoreItemOut(
                id=item.id,
                name=item.name,
                unit=item.unit,
                unit_price=unit_price or 0.0,
                selling_price=item.selling_price or 0.0,
                category_id=item.category_id,
                item_type=item.item_type
            )
            for item, unit_price in results
        ]

    except Exception as e:
        print("❌ Error in /items/simple-search:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch items.")




# --------------------------------------------------
# List Bar Items (simple)
# --------------------------------------------------
@router.get("/bar-items/simple", response_model=List[store_schemas.StoreItemOut])
def list_bar_items_simple(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant"]))
):
    """
    Fetch all store items specific to Bar (item_type='bar')
    along with their latest unit price from StoreStockEntry.
    """
    try:
        business_id = resolve_business_id(current_user, business_id)

        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(
                store_models.StoreItem.item_type == "bar",
                store_models.StoreItem.business_id == business_id
            )
            .order_by(store_models.StoreItem.name.asc())
        )

        results = query.all()

        items = [
            store_schemas.StoreItemOut(
                id=item.id,
                name=item.name,
                unit=item.unit,
                unit_price=unit_price or 0.0,
                selling_price=item.selling_price or 0.0,
                category_id=item.category_id,
                item_type=item.item_type
            )
            for item, unit_price in results
        ]

        return items

    except Exception as e:
        print("❌ Error in /bar-items/simple:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch bar items.")


# --------------------------------------------------
# Update Store Item
# --------------------------------------------------
@router.put("/items/{item_id}", response_model=store_schemas.StoreItemDisplay)
def update_item(
    item_id: int,
    update_data: store_schemas.StoreItemCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    business_id = resolve_business_id(current_user, business_id)

    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check for duplicate name within the same business
    existing = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.name == update_data.name,
            store_models.StoreItem.id != item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Item name already exists")

    for field, value in update_data.dict().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


# --------------------------------------------------
# Delete Store Item
# --------------------------------------------------
@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    business_id = resolve_business_id(current_user, business_id)

    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    return {"detail": "Item deleted successfully"}

# ----------------------------
# PURCHASE / STOCK ENTRY
# ----------------------------
@router.post("/purchases", response_model=store_schemas.PurchaseCreateList)
async def receive_inventory(
    entry: store_schemas.StoreStockEntryCreate = Depends(store_schemas.StoreStockEntryCreate.as_form),
    attachment: UploadFile = File(None),
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Resolve business
    business_id = resolve_business_id(current_user, business_id)

    # Validate item existence and business ownership
    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == entry.item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found for this business")

    # Compute total amount
    total = entry.quantity * entry.unit_price if entry.unit_price else None

    # Save attachment if provided
    attachment_path = None
    if attachment:
        upload_dir = "uploads/store_invoices"
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{attachment.filename}"
        file_location = os.path.join(upload_dir, filename)

        with open(file_location, "wb") as f:
            f.write(await attachment.read())

        attachment_path = file_location

    # Normalize datetimes
    purchase_date = entry.purchase_date.replace(tzinfo=None) if entry.purchase_date.tzinfo else entry.purchase_date
    created_at = datetime.now().replace(tzinfo=None)

    # Create and save stock entry
    stock_entry = store_models.StoreStockEntry(
        item_id=entry.item_id,
        item_name=entry.item_name,
        invoice_number=entry.invoice_number,
        quantity=entry.quantity,
        original_quantity=entry.quantity,
        unit_price=entry.unit_price,
        total_amount=total,
        vendor_id=entry.vendor_id,
        business_id=business_id,
        purchase_date=purchase_date,
        created_by=current_user.username,
        created_at=created_at,
        attachment=attachment_path,
    )
    db.add(stock_entry)
    db.commit()
    db.refresh(stock_entry)

    # Load full vendor and item info for frontend
    stock_entry = db.query(store_models.StoreStockEntry) \
        .options(
            selectinload(store_models.StoreStockEntry.vendor),
            selectinload(store_models.StoreStockEntry.item)
        ) \
        .get(stock_entry.id)

    return stock_entry


@router.get("/purchases")
def list_purchases(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    invoice_number: Optional[str] = Query(None),
    vendor_name: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    business_id: Optional[int] = Query(None),
    request: Request = None,
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Resolve business for multi-tenant filtering
    business_id = resolve_business_id(current_user, business_id)

    query = db.query(store_models.StoreStockEntry).options(
        selectinload(store_models.StoreStockEntry.vendor),
        selectinload(store_models.StoreStockEntry.item),
    ).filter(store_models.StoreStockEntry.business_id == business_id)

    # Date filters
    if start_date and end_date:
        query = query.filter(
            store_models.StoreStockEntry.purchase_date >= start_date,
            store_models.StoreStockEntry.purchase_date <= end_date
        )
    elif start_date:
        query = query.filter(store_models.StoreStockEntry.purchase_date >= start_date)
    elif end_date:
        query = query.filter(store_models.StoreStockEntry.purchase_date <= end_date)

    # Invoice filter
    if invoice_number:
        query = query.filter(store_models.StoreStockEntry.invoice_number.ilike(f"%{invoice_number}%"))

    # Vendor filters
    if vendor_id:
        query = query.filter(store_models.StoreStockEntry.vendor_id == vendor_id)
    if vendor_name:
        query = query.join(store_models.StoreStockEntry.vendor).filter(
            vendor_models.Vendor.business_name.ilike(f"%{vendor_name}%")
        )

    # Item filter
    if item_id:
        query = query.filter(store_models.StoreStockEntry.item_id == item_id)

    # Latest first
    purchases = query.order_by(store_models.StoreStockEntry.created_at.desc()).all()

    # Prepare results
    results, total_amount = [], 0
    for purchase in purchases:
        attachment_url = None
        if purchase.attachment and request:
            rel_path = os.path.relpath(purchase.attachment, "uploads").replace("\\", "/")
            base_url = str(request.base_url).rstrip("/")
            attachment_url = f"{base_url}/files/{rel_path}"

        total_amount += purchase.total_amount or 0

        results.append({
            "id": purchase.id,
            "item_id": purchase.item_id,
            "item_name": purchase.item.name if purchase.item else "",
            "invoice_number": purchase.invoice_number,
            "quantity": purchase.original_quantity,
            "unit_price": purchase.unit_price,
            "total_amount": purchase.total_amount,
            "vendor_id": purchase.vendor_id,
            "vendor_name": purchase.vendor.business_name if purchase.vendor else "",
            "purchase_date": purchase.purchase_date,
            "created_by": purchase.created_by,
            "created_at": purchase.created_at,
            "attachment_url": attachment_url,
        })

    return {
        "total_entries": len(results),
        "total_purchase": total_amount,
        "purchases": results
    }




from fastapi import HTTPException, UploadFile, File, Form
from datetime import datetime
import os

# ----------------------------
# UPDATE PURCHASE
# ----------------------------
@router.put("/purchases/{entry_id}", response_model=store_schemas.UpdatePurchase)
async def update_purchase(
    entry_id: int,
    item_id: int = Form(...),
    item_name: str = Form(...),
    invoice_number: str = Form(...),
    quantity: float = Form(...),  # new original quantity
    unit_price: float = Form(...),
    vendor_id: Optional[int] = Form(None),
    purchase_date: datetime = Form(...),
    attachment: UploadFile = File(None),
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Resolve business
    business_id = resolve_business_id(current_user, business_id)

    # Load the existing stock entry
    entry = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.id == entry_id,
            store_models.StoreStockEntry.business_id == business_id
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found for this business")

    # Ensure target item exists within same business
    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found for this business")

    # Calculate already issued units
    old_original = float(entry.original_quantity or 0)
    old_remaining = float(entry.quantity or 0)
    already_issued = max(old_original - old_remaining, 0)

    # Prevent item change if some quantity already issued
    if item_id != entry.item_id and already_issued > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot change item for a purchase that already has issued quantity. Create a new purchase instead."
        )

    # Prevent reducing quantity below already issued
    if quantity < already_issued:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce purchase quantity below amount already issued ({int(already_issued)}). Use inventory adjustment instead."
        )

    new_remaining = quantity - already_issued

    # Handle attachment upload
    if attachment:
        upload_dir = "uploads/store_invoices"
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{attachment.filename}"
        file_location = os.path.join(upload_dir, filename)

        with open(file_location, "wb") as f:
            f.write(await attachment.read())

        entry.attachment = file_location

    # Normalize datetime
    if hasattr(purchase_date, "tzinfo") and purchase_date.tzinfo is not None:
        purchase_date = purchase_date.replace(tzinfo=None)

    # Update entry
    entry.item_id = item_id
    entry.item_name = item_name
    entry.invoice_number = invoice_number
    entry.original_quantity = quantity
    entry.quantity = new_remaining
    entry.unit_price = unit_price
    entry.vendor_id = vendor_id
    entry.purchase_date = purchase_date
    entry.total_amount = (quantity * unit_price) if unit_price is not None else None

    if hasattr(entry, "updated_by"):
        entry.updated_by = current_user.username
    if hasattr(entry, "updated_at"):
        entry.updated_at = datetime.now()

    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Load related item & vendor
    entry = (
        db.query(store_models.StoreStockEntry)
        .options(
            selectinload(store_models.StoreStockEntry.vendor),
            selectinload(store_models.StoreStockEntry.item),
        )
        .get(entry.id)
    )

    attachment_url = (
        f"/files/{os.path.relpath(entry.attachment, 'uploads').replace(os.sep, '/')}"
        if entry.attachment else None
    )

    return {
        "id": entry.id,
        "item_id": entry.item_id,
        "item_name": entry.item.name if entry.item else "",
        "invoice_number": entry.invoice_number,
        "quantity": entry.original_quantity,
        "unit_price": entry.unit_price,
        "total_amount": entry.total_amount,
        "vendor_id": entry.vendor_id,
        "vendor_name": entry.vendor.business_name if entry.vendor else "",
        "purchase_date": entry.purchase_date,
        "created_by": entry.created_by,
        "created_at": entry.created_at,
        "attachment": entry.attachment,
        "attachment_url": attachment_url,
    }


# ----------------------------
# DELETE PURCHASE
# ----------------------------
@router.delete("/purchases/{entry_id}")
def delete_purchase(
    entry_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Resolve business
    business_id = resolve_business_id(current_user, business_id)

    # Fetch purchase entry
    entry = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.id == entry_id,
            store_models.StoreStockEntry.business_id == business_id
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found for this business")

    # Prevent deletion if any units issued
    if entry.quantity < entry.original_quantity:
        issued_amount = entry.original_quantity - entry.quantity
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete this purchase. {issued_amount} unit(s) have already been issued. Delete the issues first."
        )

    db.delete(entry)
    db.commit()

    return {"detail": "Purchase entry deleted successfully"}




# ----------------------------
# Helpers
# ----------------------------
def now_wat() -> datetime:
    """Return current time in Africa/Lagos as timezone-aware datetime"""
    return datetime.now(WAT)


def now_utc() -> datetime:
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


# ----------------------------
# Issue to Kitchen Endpoint
# ----------------------------
@router.post("/kitchen", response_model=IssueToKitchenDisplay)
def issue_kitchen(
    issue_data: IssueToKitchenCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    ),
):
    # Resolve business/tenant
    business_id = resolve_business_id(current_user, business_id)

    if not issue_data.issue_items:
        raise HTTPException(status_code=400, detail="No items provided for issue.")

    # Use provided issue_date or current UTC
    issue_date = issue_data.issue_date or now_utc()

    # Ensure issue_date is timezone-aware UTC
    if issue_date.tzinfo is None:
        issue_date = issue_date.replace(tzinfo=timezone.utc)
    else:
        issue_date = issue_date.astimezone(timezone.utc)

    # Restrict past-date issues for non-admins (compare in WAT)
    issue_date_wat = issue_date.astimezone(WAT)
    if issue_date_wat.date() != now_wat().date() and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=400,
            detail="Only admins can post issues for a past date."
        )

    # Validate kitchen
    kitchen = db.query(kitchen_models.Kitchen).filter(
        kitchen_models.Kitchen.id == issue_data.kitchen_id,
        kitchen_models.Kitchen.business_id == business_id,
    ).first()
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")

    # Create StoreIssue record (store UTC in DB)
    issue = store_models.StoreIssue(
        business_id=business_id,
        issue_to="kitchen",
        issued_by_id=current_user.id,
        kitchen_id=issue_data.kitchen_id,
        issue_date=issue_date
    )
    db.add(issue)
    db.flush()  # get issue.id

    issue_items_display: List[IssueToKitchenItemDisplay] = []

    for item_data in issue_data.issue_items:
        # Validate item belongs to business
        item_obj = db.query(store_models.StoreItem).filter(
            store_models.StoreItem.id == item_data.item_id,
            store_models.StoreItem.business_id == business_id,
        ).first()
        if not item_obj:
            raise HTTPException(
                status_code=404, detail=f"Item {item_data.item_id} not found"
            )

        # Check total stock
        total_available_stock = (
            db.query(func.sum(store_models.StoreStockEntry.quantity))
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.business_id == business_id,
            )
            .scalar()
            or 0
        )
        if total_available_stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough inventory for item {item_obj.name}"
            )

        # Create StoreIssueItem
        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=business_id
        )
        db.add(issue_item)

        # Deduct stock FIFO
        remaining = item_data.quantity
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.quantity > 0,
                store_models.StoreStockEntry.business_id == business_id,
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            if remaining <= 0:
                break
            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # Update kitchen inventory
        kitchen_inventory = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == item_data.item_id,
                kitchen_models.KitchenInventory.business_id == business_id,
            )
            .first()
        )
        if kitchen_inventory:
            kitchen_inventory.quantity += item_data.quantity
        else:
            kitchen_inventory = kitchen_models.KitchenInventory(
                business_id=business_id,
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity
            )
            db.add(kitchen_inventory)

        # Prepare display response
        issue_items_display.append(
            IssueToKitchenItemDisplay(
                item=KitchenItemMinimalDisplay(
                    id=item_obj.id,
                    name=item_obj.name
                ),
                quantity=item_data.quantity
            )
        )

    db.commit()
    db.refresh(issue)

    # Safely convert issue_date to WAT for response
    if issue.issue_date.tzinfo is None:
        issue_date_wat = issue.issue_date.replace(tzinfo=timezone.utc).astimezone(WAT)
    else:
        issue_date_wat = issue.issue_date.astimezone(WAT)

    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=KitchenDisplaySimple(id=kitchen.id, name=kitchen.name),
        issue_items=issue_items_display,
        issue_date=issue_date_wat.isoformat()  # ISO string with +01:00 TZ
    )



@router.get("/kitchen", response_model=List[IssueToKitchenDisplay])
def list_kitchen_issues(
    kitchen_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):

    business_id = resolve_business_id(current_user, business_id)

    query = db.query(store_models.StoreIssue).filter(
        store_models.StoreIssue.issue_to == "kitchen",
        store_models.StoreIssue.business_id == business_id
    )

    if kitchen_id:
        query = query.filter(store_models.StoreIssue.kitchen_id == kitchen_id)

    if start_date:
        query = query.filter(store_models.StoreIssue.issue_date >= start_date)

    if end_date:
        query = query.filter(store_models.StoreIssue.issue_date <= end_date)

    issues = query.order_by(store_models.StoreIssue.issue_date.desc()).all()

    result = []

    for issue in issues:

        kitchen = db.query(kitchen_models.Kitchen).filter(
            kitchen_models.Kitchen.id == issue.kitchen_id
        ).first()

        kitchen_display = KitchenDisplaySimple(
            id=kitchen.id,
            name=kitchen.name
        ) if kitchen else None

        issue_items_display = []

        for issue_item in issue.issue_items:

            item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == issue_item.item_id
            ).first()

            issue_items_display.append(
                IssueToKitchenItemDisplay(
                    item=KitchenItemMinimalDisplay(
                        id=issue_item.item_id,
                        name=item.name if item else None
                    ),
                    quantity=issue_item.quantity
                )
            )

        result.append(
            IssueToKitchenDisplay(
                id=issue.id,
                kitchen=kitchen_display,
                issue_items=issue_items_display,
                issue_date=issue.issue_date
            )
        )

    return result




WAT = ZoneInfo("Africa/Lagos")


def now_wat() -> datetime:
    """Return current time in Africa/Lagos timezone"""
    return datetime.now(WAT)


@router.put("/kitchen/{issue_id}", response_model=IssueToKitchenDisplay)
def update_kitchen_issue(
    issue_id: int,
    issue_data: IssueToKitchenCreate,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    # ----------------------------
    # Resolve business/tenant
    # ----------------------------
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    # ----------------------------
    # Fetch existing kitchen issue
    # ----------------------------
    issue = (
        db.query(store_models.StoreIssue)
        .filter_by(id=issue_id, issue_to="kitchen", business_id=effective_business_id)
        .first()
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Kitchen issue not found")

    # ----------------------------
    # Reverse old stock and kitchen inventory
    # ----------------------------
    for old_item in issue.issue_items:
        # Restore store stock (FIFO reverse)
        remaining = old_item.quantity
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == old_item.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            entry.quantity += remaining
            remaining = 0
            if remaining <= 0:
                break

        # Reduce kitchen inventory
        kitchen_inv = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == old_item.item_id,
                kitchen_models.KitchenInventory.business_id == effective_business_id
            )
            .first()
        )
        if kitchen_inv:
            kitchen_inv.quantity -= old_item.quantity

        db.delete(old_item)

    db.flush()

    # ----------------------------
    # Update issue info
    # ----------------------------
    issue.issue_date = issue_data.issue_date or datetime.now(timezone.utc)
    if issue.issue_date.tzinfo is None:
        issue.issue_date = issue.issue_date.replace(tzinfo=timezone.utc)

    issue.kitchen_id = issue_data.kitchen_id

    # ----------------------------
    # Recreate issue items and adjust stock
    # ----------------------------
    issue_items_display: List[IssueToKitchenItemDisplay] = []

    for item_data in issue_data.issue_items:
        # Validate item belongs to business
        item_obj = db.query(store_models.StoreItem).filter_by(
            id=item_data.item_id, business_id=effective_business_id
        ).first()
        if not item_obj:
            raise HTTPException(status_code=404, detail=f"Item {item_data.item_id} not found")

        # Check stock
        total_available_stock = (
            db.query(func.sum(store_models.StoreStockEntry.quantity))
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .scalar() or 0
        )
        if total_available_stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough inventory for item {item_obj.name}"
            )

        # Create new StoreIssueItem
        new_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=effective_business_id
        )
        db.add(new_item)

        # Deduct stock FIFO
        remaining = item_data.quantity
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.quantity > 0,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            if remaining <= 0:
                break
            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # Update kitchen inventory
        kitchen_inv = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == item_data.item_id,
                kitchen_models.KitchenInventory.business_id == effective_business_id
            )
            .first()
        )
        if kitchen_inv:
            kitchen_inv.quantity += item_data.quantity
        else:
            kitchen_inv = kitchen_models.KitchenInventory(
                business_id=effective_business_id,
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity
            )
            db.add(kitchen_inv)

        # Prepare display response
        issue_items_display.append(
            IssueToKitchenItemDisplay(
                item=KitchenItemMinimalDisplay(id=item_obj.id, name=item_obj.name),
                quantity=item_data.quantity
            )
        )

    db.commit()
    db.refresh(issue)

    # Fetch kitchen display info
    kitchen_obj = db.query(kitchen_models.Kitchen).filter_by(id=issue.kitchen_id).first()
    kitchen_display = KitchenDisplaySimple(id=kitchen_obj.id, name=kitchen_obj.name)

    # Convert issue_date to WAT for response
    issue_date_wat = issue.issue_date.astimezone(WAT)

    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=kitchen_display,
        issue_items=issue_items_display,
        issue_date=issue_date_wat.isoformat()
    )




# ----------------------------
# List Kitchen Items
# ----------------------------
@router.get("/store/kitchen-items", response_model=List[StoreItemDisplay])
def list_kitchen_items(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    """
    List all store items that are kitchen items.
    Filter directly by item_type='kitchen'.
    """
    # Resolve business/tenant
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    kitchen_items = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.item_type == "kitchen",
            store_models.StoreItem.business_id == effective_business_id
        )
        .order_by(store_models.StoreItem.name.asc())
        .all()
    )
    return kitchen_items


# ----------------------------
# Delete Kitchen Issue
# ----------------------------
@router.delete("/kitchen/{issue_id}", response_model=dict)
def delete_kitchen_issue(
    issue_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    # Resolve business/tenant
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    # Fetch the issue
    issue = (
        db.query(store_models.StoreIssue)
        .filter_by(id=issue_id, issue_to="kitchen", business_id=effective_business_id)
        .first()
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Kitchen issue not found")

    # Restore store stock and kitchen inventory
    for item in issue.issue_items:
        # Restore stock FIFO
        remaining = item.quantity
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            entry.quantity += remaining
            remaining = 0
            if remaining <= 0:
                break

        # Reduce kitchen inventory
        kitchen_inv = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == item.item_id,
                kitchen_models.KitchenInventory.business_id == effective_business_id
            )
            .first()
        )
        if kitchen_inv:
            kitchen_inv.quantity -= item.quantity

        # Delete issue items
        db.delete(item)

    # Delete the issue itself
    db.delete(issue)
    db.commit()

    return {"detail": "Kitchen issue deleted successfully"}



# ----------------------------
# ISSUE TO BAR (Update BarInventory)
# ----------------------------

@router.post("/bar", response_model=store_schemas.IssueDisplay)
def issue_to_bar(
    issue_data: store_schemas.IssueCreate,  # expects issue_to="bar" and issued_to_id=bar_id
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    ),
):
    # ------------------------------
    # 1️⃣ Resolve business (multi-tenant)
    # ------------------------------
    if "super_admin" in current_user.roles:
        if not business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
        effective_business_id = business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # 2️⃣ Validate bar exists
    # ------------------------------
    bar_obj = (
        db.query(bar_models.Bar)
        .filter_by(id=issue_data.issued_to_id, business_id=effective_business_id)
        .first()
    )
    if not bar_obj:
        raise HTTPException(status_code=404, detail="Bar not found")

    # ------------------------------
    # 3️⃣ Determine issue date (timezone-aware)
    # ------------------------------
    issue_date = issue_data.issue_date or datetime.now(timezone.utc)
    if issue_date.tzinfo is None:
        issue_date = issue_date.replace(tzinfo=timezone.utc)

    # Restrict past-date issues for non-admins
    if to_wat(issue_date).date() != now_wat().date() and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=400,
            detail="Only admins can post issues for a past date."
        )

    # ------------------------------
    # 4️⃣ Create StoreIssue
    # ------------------------------
    issue = store_models.StoreIssue(
        business_id=effective_business_id,
        issue_to="bar",
        issued_by_id=current_user.id,
        bar_id=issue_data.issued_to_id,
        issue_date=issue_date
    )
    db.add(issue)
    db.flush()  # assign issue.id

    # ------------------------------
    # 5️⃣ Process each issued item
    # ------------------------------
    issue_items_display: List[store_schemas.IssueItemDisplay] = []

    for item_data in issue_data.issue_items:
        # Validate store item
        item_obj = (
            db.query(store_models.StoreItem)
            .filter_by(id=item_data.item_id, business_id=effective_business_id)
            .first()
        )
        if not item_obj:
            raise HTTPException(404, detail=f"Item {item_data.item_id} not found")

        # Check stock availability
        total_available_stock = (
            db.query(func.sum(store_models.StoreStockEntry.quantity))
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .scalar() or 0
        )
        if total_available_stock < item_data.quantity:
            raise HTTPException(400, detail=f"Not enough inventory for item {item_obj.name}")

        # Create StoreIssueItem
        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=effective_business_id
        )
        db.add(issue_item)
        db.flush()  # ✅ ensure issue_item.id is populated

        # Deduct store stock (FIFO)
        remaining = item_data.quantity
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.quantity > 0,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            if remaining <= 0:
                break
            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # Update BarInventory
        bar_inventory = (
            db.query(bar_models.BarInventory)
            .filter_by(
                bar_id=issue.bar_id,
                item_id=item_data.item_id,
                business_id=effective_business_id
            )
            .first()
        )
        if bar_inventory:
            bar_inventory.quantity += item_data.quantity
        else:
            bar_inventory = bar_models.BarInventory(
                business_id=effective_business_id,
                bar_id=issue.bar_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
                selling_price=item_obj.selling_price
            )
            db.add(bar_inventory)

        # Prepare display item
        display_item = store_schemas.IssueItemDisplay(
            id=issue_item.id,
            item=store_schemas.StoreItemDisplay(
                id=item_obj.id,
                name=item_obj.name,
                unit=item_obj.unit,
                category=store_schemas.StoreCategoryDisplay(
                    id=item_obj.category.id,
                    name=item_obj.category.name,
                    created_at=item_obj.category.created_at
                ) if item_obj.category else None,
                unit_price=item_obj.unit_price,
                selling_price=item_obj.selling_price,
                created_at=item_obj.created_at
            ),
            quantity=item_data.quantity
        )
        issue_items_display.append(display_item)

    # ------------------------------
    # 6️⃣ Commit all changes and refresh issue
    # ------------------------------
    db.commit()
    db.refresh(issue)

    # ------------------------------
    # 7️⃣ Return IssueDisplay with WAT date
    # ------------------------------
    return store_schemas.IssueDisplay(
        id=issue.id,
        issue_to="bar",
        issued_to_id=issue.bar_id,
        issued_to=bar_obj,
        issue_date=to_wat(issue_date),
        issue_items=issue_items_display
    )





@router.get("/bar", response_model=List[store_schemas.IssueDisplay])
def list_issues_to_bar(
    bar_id: Optional[int] = Query(None, description="Filter by bar"),
    start_date: Optional[date] = Query(None, description="Start issue date"),
    end_date: Optional[date] = Query(None, description="End issue date"),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    )
):
    try:
        # ------------------------------
        # 1️⃣ Determine effective business
        # ------------------------------
        if "super_admin" in current_user.roles:
            if not business_id:
                raise HTTPException(status_code=400, detail="Super admin must provide business_id")
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # ------------------------------
        # 2️⃣ Base query
        # ------------------------------
        query = (
            db.query(store_models.StoreIssue)
            .filter(
                store_models.StoreIssue.issue_to == "bar",
                store_models.StoreIssue.business_id == effective_business_id
            )
        )

        if bar_id:
            query = query.filter(store_models.StoreIssue.bar_id == bar_id)

        if start_date:
            query = query.filter(store_models.StoreIssue.issue_date >= start_date)

        if end_date:
            query = query.filter(store_models.StoreIssue.issue_date <= end_date)

        issues = query.order_by(store_models.StoreIssue.issue_date.desc()).all()
        result: List[store_schemas.IssueDisplay] = []

        # ------------------------------
        # 3️⃣ Build response
        # ------------------------------
        for issue in issues:
            issue_items_display: List[store_schemas.IssueItemDisplay] = []

            for issue_item in issue.issue_items:
                item_obj = (
                    db.query(store_models.StoreItem)
                    .filter_by(id=issue_item.item_id, business_id=effective_business_id)
                    .first()
                )
                if not item_obj:
                    continue

                display_item = store_schemas.IssueItemDisplay(
                    id=issue_item.id,
                    item=store_schemas.StoreItemDisplay(
                        id=item_obj.id,
                        name=item_obj.name,
                        unit=item_obj.unit,
                        category=(
                            store_schemas.StoreCategoryDisplay(
                                id=item_obj.category.id,
                                name=item_obj.category.name,
                                created_at=item_obj.category.created_at
                            ) if item_obj.category else None
                        ),
                        unit_price=item_obj.unit_price,
                        selling_price=item_obj.selling_price,
                        created_at=item_obj.created_at
                    ),
                    quantity=issue_item.quantity
                )
                issue_items_display.append(display_item)

            bar_obj = (
                db.query(bar_models.Bar)
                .filter_by(id=issue.bar_id, business_id=effective_business_id)
                .first()
            )

            result.append(
                store_schemas.IssueDisplay(
                    id=issue.id,
                    issue_to="bar",
                    issued_to_id=issue.bar_id,
                    issued_to=bar_obj,
                    issue_date=to_wat(issue.issue_date),  # ✅ convert to WAT
                    issue_items=issue_items_display
                )
            )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve bar issues: {str(e)}"
        )

                                            

@router.get("/stock/{item_id}")
def get_item_stock(
    item_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    # ------------------------------
    # 1️⃣ Determine effective business
    # ------------------------------
    if "super_admin" in current_user.roles:
        if not business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id")
        effective_business_id = business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # 2️⃣ Check if business exists
    # ------------------------------
    business_exists = db.query(business_models.Business).filter_by(id=effective_business_id).first()
    if not business_exists:
        return {
            "item_id": item_id,
            "business_id": effective_business_id,
            "available": 0,
            "message": "Business does not exist",
            "queried_at": now_wat().isoformat()
        }

    # ------------------------------
    # 3️⃣ Check if item exists for the business
    # ------------------------------
    item_exists = db.query(store_models.StoreItem).filter_by(
        id=item_id,
        business_id=effective_business_id
    ).first()
    if not item_exists:
        return {
            "item_id": item_id,
            "business_id": effective_business_id,
            "available": 0,
            "message": "Item not available",
            "queried_at": now_wat().isoformat()
        }

    # ------------------------------
    # 4️⃣ Calculate total stock
    # ------------------------------
    total = (
        db.query(func.sum(store_models.StoreStockEntry.quantity))
        .filter(
            store_models.StoreStockEntry.item_id == item_id,
            store_models.StoreStockEntry.business_id == effective_business_id
        )
        .scalar()
    ) or 0

    # ------------------------------
    # 5️⃣ Return structured response
    # ------------------------------
    return {
        "item_id": item_id,
        "business_id": effective_business_id,
        "available": total,
        "message": "Success" if total > 0 else "Item out of stock",
        "queried_at": now_wat().isoformat()
    }




@router.put("/bar-issues/{issue_id}", response_model=store_schemas.IssueDisplay)
def update_bar_issue(
    issue_id: int,
    update_data: store_schemas.IssueCreate,
    business_id: Optional[int] = Query(None, description="Super admin can optionally specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store","admin","super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ------------------------------
    # 1️⃣ Get issue first
    # ------------------------------
    issue = db.query(store_models.StoreIssue).filter(
        store_models.StoreIssue.id == issue_id
    ).first()

    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.issue_to != "bar":
        raise HTTPException(status_code=400, detail="Only bar issues can be updated")

    # ------------------------------
    # 2️⃣ Resolve business
    # ------------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else issue.business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # 3️⃣ Validate bar exists
    # ------------------------------
    bar_obj = (
        db.query(bar_models.Bar)
        .filter(
            bar_models.Bar.id == update_data.issued_to_id,
            bar_models.Bar.business_id == effective_business_id
        )
        .first()
    )

    if not bar_obj:
        raise HTTPException(status_code=404, detail="Bar not found")

    # ------------------------------
    # 4️⃣ Rollback old issue
    # ------------------------------
    for old_item in issue.issue_items:

        remaining = old_item.quantity

        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == old_item.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.desc())
            .all()
        )

        for entry in stock_entries:
            if remaining <= 0:
                break

            entry.quantity += remaining
            remaining = 0

        bar_inv = (
            db.query(bar_models.BarInventory)
            .filter(
                bar_models.BarInventory.bar_id == issue.bar_id,
                bar_models.BarInventory.item_id == old_item.item_id,
                bar_models.BarInventory.business_id == effective_business_id
            )
            .first()
        )

        if bar_inv:
            bar_inv.quantity = max(0, bar_inv.quantity - old_item.quantity)

    db.query(store_models.StoreIssueItem).filter(
        store_models.StoreIssueItem.issue_id == issue_id
    ).delete()

    # ------------------------------
    # 5️⃣ Validate stock
    # ------------------------------
    for item in update_data.issue_items:

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item.item_id,
                store_models.StoreItem.business_id == effective_business_id
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(status_code=404, detail=f"Item {item.item_id} not found")

        available = (
            db.query(func.sum(store_models.StoreStockEntry.quantity))
            .filter(
                store_models.StoreStockEntry.item_id == item.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .scalar()
        ) or 0

        if available < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for item {item_obj.name}"
            )

    # ------------------------------
    # 6️⃣ Update issue header
    # ------------------------------
    issue.bar_id = update_data.issued_to_id
    issue.issue_date = update_data.issue_date or datetime.now(timezone.utc)
    issue.issued_by_id = current_user.id

    issue_items_display: List[store_schemas.IssueItemDisplay] = []

    # ------------------------------
    # 7️⃣ Apply new issue (FIFO)
    # ------------------------------
    for item in update_data.issue_items:

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item.item_id,
                store_models.StoreItem.business_id == effective_business_id
            )
            .first()
        )

        remaining = item.quantity

        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item.item_id,
                store_models.StoreStockEntry.quantity > 0,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )

        for entry in stock_entries:

            if remaining <= 0:
                break

            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # ------------------------------
        # Update bar inventory
        # ------------------------------
        bar_inv = (
            db.query(bar_models.BarInventory)
            .filter(
                bar_models.BarInventory.bar_id == issue.bar_id,
                bar_models.BarInventory.item_id == item.item_id,
                bar_models.BarInventory.business_id == effective_business_id
            )
            .first()
        )

        if bar_inv:
            bar_inv.quantity += item.quantity
        else:
            bar_inv = bar_models.BarInventory(
                business_id=effective_business_id,
                bar_id=issue.bar_id,
                item_id=item.item_id,
                quantity=item.quantity,
                selling_price=item_obj.selling_price
            )
            db.add(bar_inv)

        issue_item = store_models.StoreIssueItem(
            business_id=effective_business_id,
            issue_id=issue.id,
            item_id=item.item_id,
            quantity=item.quantity
        )

        db.add(issue_item)
        db.flush()

        issue_items_display.append(
            store_schemas.IssueItemDisplay(
                id=issue_item.id,
                item=store_schemas.StoreItemDisplay(
                    id=item_obj.id,
                    name=item_obj.name,
                    unit=item_obj.unit,
                    category=store_schemas.StoreCategoryDisplay(
                        id=item_obj.category.id,
                        name=item_obj.category.name,
                        created_at=item_obj.category.created_at
                    ) if item_obj.category else None,
                    unit_price=item_obj.unit_price,
                    selling_price=item_obj.selling_price,
                    created_at=item_obj.created_at
                ),
                quantity=item.quantity
            )
        )

    # ------------------------------
    # 8️⃣ Commit
    # ------------------------------
    db.commit()
    db.refresh(issue)

    return store_schemas.IssueDisplay(
        id=issue.id,
        issue_to="bar",
        issued_to_id=issue.bar_id,
        issued_to=bar_obj,
        issue_date=to_wat(issue.issue_date),
        issue_items=issue_items_display
    )




@router.delete("/bar-issues/{issue_id}")
def delete_bar_issue(
    issue_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin", "super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ----------------------------
    # 1️⃣ Fetch issue
    # ----------------------------
    issue = db.query(store_models.StoreIssue).filter(
        store_models.StoreIssue.id == issue_id
    ).first()

    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.issue_to.lower() != "bar":
        raise HTTPException(status_code=400, detail="This endpoint only deletes bar issues")

    # ----------------------------
    # 2️⃣ Resolve business
    # ----------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else issue.business_id
    else:
        effective_business_id = current_user.business_id

    # Prevent deleting another business issue
    if issue.business_id != effective_business_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this issue")

    # ----------------------------
    # 3️⃣ Restore stock
    # ----------------------------
    for item in issue.issue_items:

        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.item_id == item.item_id,
                store_models.StoreStockEntry.business_id == effective_business_id
            )
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )

        remaining_to_restore = item.quantity

        for stock_entry in stock_entries:
            if remaining_to_restore <= 0:
                break

            stock_entry.quantity += remaining_to_restore
            remaining_to_restore = 0

        # ----------------------------
        # Reduce bar inventory
        # ----------------------------
        bar_inventory = (
            db.query(bar_models.BarInventory)
            .filter(
                bar_models.BarInventory.bar_id == issue.bar_id,
                bar_models.BarInventory.item_id == item.item_id,
                bar_models.BarInventory.business_id == effective_business_id
            )
            .first()
        )

        if bar_inventory:
            bar_inventory.quantity -= item.quantity

            if bar_inventory.quantity < 0:
                bar_inventory.quantity = 0

    # ----------------------------
    # 4️⃣ Delete issue items
    # ----------------------------
    for item in issue.issue_items:
        db.delete(item)

    # ----------------------------
    # 5️⃣ Delete issue
    # ----------------------------
    db.delete(issue)

    db.commit()

    return {
        "message": "Bar issue deleted and stock restored successfully",
        "issue_id": issue_id,
        "business_id": effective_business_id
    }


@router.post("/adjust", response_model=store_schemas.StoreInventoryAdjustmentDisplay)
def adjust_store_inventory(
    adjustment_data: store_schemas.StoreInventoryAdjustmentCreate,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin","super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ------------------------------
    # Resolve business
    # ------------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Validate item
    # ------------------------------
    item_obj = db.query(store_models.StoreItem).filter(
        store_models.StoreItem.id == adjustment_data.item_id,
        store_models.StoreItem.business_id == effective_business_id
    ).first()

    if not item_obj:
        raise HTTPException(status_code=404, detail="Item not found")

    # ------------------------------
    # Get latest stock entry
    # ------------------------------
    latest_entry = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.item_id == adjustment_data.item_id,
            store_models.StoreStockEntry.business_id == effective_business_id,
            store_models.StoreStockEntry.quantity > 0
        )
        .order_by(store_models.StoreStockEntry.purchase_date.desc())
        .first()
    )

    if not latest_entry:
        raise HTTPException(status_code=404, detail="Item out of stock")

    if adjustment_data.quantity_adjusted > latest_entry.quantity:
        raise HTTPException(status_code=400, detail="Adjustment exceeds available stock")

    # ------------------------------
    # Deduct quantity
    # ------------------------------
    latest_entry.quantity -= adjustment_data.quantity_adjusted
    db.add(latest_entry)

    # ------------------------------
    # Log adjustment
    # ------------------------------
    adjustment = store_models.StoreInventoryAdjustment(
        business_id=effective_business_id,
        item_id=adjustment_data.item_id,
        quantity_adjusted=adjustment_data.quantity_adjusted,
        reason=adjustment_data.reason,
        adjusted_by=current_user.username,
        adjusted_at=now_wat()
    )

    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    # ------------------------------
    # Category display
    # ------------------------------
    category_display = None
    if item_obj.category:
        category_display = store_schemas.StoreCategoryDisplay(
            id=item_obj.category.id,
            name=item_obj.category.name,
            category_name=item_obj.category.name or "Unknown",
            created_at=item_obj.category.created_at
        )

    item_display = store_schemas.StoreItemDisplay(
        id=item_obj.id,
        name=item_obj.name,
        unit=item_obj.unit,
        category=category_display,
        unit_price=item_obj.unit_price,
        selling_price=item_obj.selling_price,
        created_at=item_obj.created_at
    )

    return store_schemas.StoreInventoryAdjustmentDisplay(
        id=adjustment.id,
        item=item_display,
        quantity_adjusted=adjustment.quantity_adjusted,
        reason=adjustment.reason,
        adjusted_by=adjustment.adjusted_by,
        adjusted_at=adjustment.adjusted_at
    )




@router.get("/adjustments", response_model=list[store_schemas.StoreInventoryAdjustmentDisplay])
def list_store_inventory_adjustments(
    item_id: Optional[int] = Query(None, description="Filter by item"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store","admin","super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ------------------------------
    # Resolve business
    # ------------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Base query
    # ------------------------------
    query = db.query(store_models.StoreInventoryAdjustment).filter(
        store_models.StoreInventoryAdjustment.business_id == effective_business_id
    )

    if item_id:
        query = query.filter(store_models.StoreInventoryAdjustment.item_id == item_id)

    if start_date:
        query = query.filter(store_models.StoreInventoryAdjustment.adjusted_at >= start_date)

    if end_date:
        query = query.filter(store_models.StoreInventoryAdjustment.adjusted_at <= end_date)

    adjustments = query.order_by(
        store_models.StoreInventoryAdjustment.adjusted_at.desc()
    ).all()

    results = []

    for adj in adjustments:

        item_obj = db.query(store_models.StoreItem).filter(
            store_models.StoreItem.id == adj.item_id,
            store_models.StoreItem.business_id == effective_business_id
        ).first()

        if not item_obj:
            continue

        category_display = None
        if item_obj.category:
            category_display = store_schemas.StoreCategoryDisplay(
                id=item_obj.category.id,
                name=item_obj.category.name,
                category_name=item_obj.category.name or "Unknown",
                created_at=item_obj.category.created_at
            )

        item_display = store_schemas.StoreItemDisplay(
            id=item_obj.id,
            name=item_obj.name,
            unit=item_obj.unit,
            category=category_display,
            unit_price=item_obj.unit_price,
            selling_price=item_obj.selling_price,
            created_at=item_obj.created_at
        )

        results.append(
            store_schemas.StoreInventoryAdjustmentDisplay(
                id=adj.id,
                item=item_display,
                quantity_adjusted=adj.quantity_adjusted,
                reason=adj.reason,
                adjusted_by=adj.adjusted_by,
                adjusted_at=adj.adjusted_at
            )
        )

    return results





@router.put("/adjustments/{adjustment_id}")
def update_adjustment(
    adjustment_id: int,
    data: StoreInventoryAdjustmentCreate,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin","super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ------------------------------
    # Resolve business
    # ------------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Load adjustment
    # ------------------------------
    adjustment = db.query(StoreInventoryAdjustment).filter(
        StoreInventoryAdjustment.id == adjustment_id,
        StoreInventoryAdjustment.business_id == effective_business_id
    ).first()

    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    # ------------------------------
    # Helper: latest stock entry
    # ------------------------------
    def latest_entry_for(item_id: int):
        return db.query(StoreStockEntry).filter(
            StoreStockEntry.item_id == item_id,
            StoreStockEntry.business_id == effective_business_id
        ).order_by(StoreStockEntry.purchase_date.desc()).first()

    # ------------------------------
    # CASE A: Same item
    # ------------------------------
    if data.item_id == adjustment.item_id:

        entry = latest_entry_for(adjustment.item_id)

        if not entry:
            raise HTTPException(status_code=404, detail="Stock entry not found")

        old_qty = adjustment.quantity_adjusted
        new_qty = data.quantity_adjusted

        delta = new_qty - old_qty

        if delta > 0:
            if entry.quantity < delta:
                raise HTTPException(status_code=400, detail="Adjustment exceeds available stock")
            entry.quantity -= delta

        elif delta < 0:
            entry.quantity += abs(delta)

        adjustment.quantity_adjusted = new_qty
        adjustment.reason = data.reason

        db.add(entry)
        db.add(adjustment)
        db.commit()
        db.refresh(adjustment)

        return {
            "message": "Adjustment updated successfully",
            "adjustment_id": adjustment.id,
            "current_stock": entry.quantity
        }

    # ------------------------------
    # CASE B: Item changed
    # ------------------------------

    old_entry = latest_entry_for(adjustment.item_id)

    if not old_entry:
        raise HTTPException(status_code=404, detail="Old stock entry not found")

    # restore old item
    old_entry.quantity += adjustment.quantity_adjusted

    new_entry = latest_entry_for(data.item_id)

    if not new_entry:
        raise HTTPException(status_code=404, detail="New stock entry not found")

    if new_entry.quantity < data.quantity_adjusted:
        raise HTTPException(status_code=400, detail="Adjustment exceeds stock for new item")

    new_entry.quantity -= data.quantity_adjusted

    adjustment.item_id = data.item_id
    adjustment.quantity_adjusted = data.quantity_adjusted
    adjustment.reason = data.reason

    db.add(old_entry)
    db.add(new_entry)
    db.add(adjustment)

    db.commit()
    db.refresh(adjustment)

    return {
        "message": "Adjustment updated successfully (item changed)",
        "adjustment_id": adjustment.id,
        "old_item_stock": old_entry.quantity,
        "new_item_stock": new_entry.quantity
    }



@router.delete("/adjustments/{adjustment_id}")
def delete_adjustment(
    adjustment_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin","super_admin"]))
):

    roles = [r.lower() for r in current_user.roles]

    # ------------------------------
    # Resolve business
    # ------------------------------
    if "super_admin" in roles:
        effective_business_id = business_id if business_id else current_user.business_id
    else:
        effective_business_id = current_user.business_id

    # ------------------------------
    # Get adjustment
    # ------------------------------
    adjustment = db.query(StoreInventoryAdjustment).filter(
        StoreInventoryAdjustment.id == adjustment_id,
        StoreInventoryAdjustment.business_id == effective_business_id
    ).first()

    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    # ------------------------------
    # Get latest stock entry
    # ------------------------------
    stock_entry = db.query(StoreStockEntry).filter(
        StoreStockEntry.item_id == adjustment.item_id,
        StoreStockEntry.business_id == effective_business_id
    ).order_by(StoreStockEntry.purchase_date.desc()).first()

    if not stock_entry:
        raise HTTPException(status_code=404, detail="Stock entry not found")

    # Restore quantity
    stock_entry.quantity += adjustment.quantity_adjusted
    db.add(stock_entry)

    # Delete adjustment
    db.delete(adjustment)

    db.commit()

    return {
        "message": "Adjustment deleted successfully",
        "item_id": adjustment.item_id,
        "restored_quantity": adjustment.quantity_adjusted,
        "current_stock": stock_entry.quantity
    }





@router.get("/bar-balance-stock", response_model=List[bar_schemas.BarStockBalance])
def get_bar_stock_balance(
    item_id: Optional[int] = Query(None, description="Filter by specific item"),
    bar_id: Optional[int] = Query(None, description="Filter by bar"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "bar", "admin", "super_admin"]))
):
    try:

        roles = [r.lower() for r in current_user.roles]

        # Resolve business
        if "super_admin" in roles:
            effective_business_id = business_id if business_id else current_user.business_id
        else:
            effective_business_id = current_user.business_id

        # =============================================================
        # 1️⃣ ISSUED ITEMS (Store → Bar)
        # =============================================================
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.bar_id.label("bar_id"),
                func.sum(store_models.StoreIssueItem.quantity).label("total_received"),
            )
            .join(store_models.StoreIssue)
            .join(store_models.StoreItem)
            .filter(
                store_models.StoreIssue.issue_to == "bar",
                store_models.StoreIssue.business_id == effective_business_id,
                store_models.StoreItem.business_id == effective_business_id
            )
        )

        if item_id:
            issued_query = issued_query.filter(store_models.StoreItem.id == item_id)

        if bar_id:
            issued_query = issued_query.filter(store_models.StoreIssue.bar_id == bar_id)

        if start_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issue_date >= start_date)

        if end_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issue_date <= end_date)

        issued_query = issued_query.group_by(
            store_models.StoreIssueItem.item_id,
            store_models.StoreIssue.bar_id,
        )

        issued_data = {
            (row.item_id, row.bar_id): float(row.total_received or 0)
            for row in issued_query.all()
        }

        # =============================================================
        # 2️⃣ SOLD ITEMS (Bar Sales)
        # =============================================================
        sold_query = (
            db.query(
                bar_models.BarInventory.item_id,
                bar_models.BarSale.bar_id,
                func.sum(bar_models.BarSaleItem.quantity).label("total_sold"),
            )
            .join(bar_models.BarSaleItem.bar_inventory)
            .join(bar_models.BarSaleItem.sale)
            .join(store_models.StoreItem, bar_models.BarInventory.item_id == store_models.StoreItem.id)
            .filter(
                bar_models.BarSale.business_id == effective_business_id,
                store_models.StoreItem.business_id == effective_business_id
            )
        )

        if item_id:
            sold_query = sold_query.filter(store_models.StoreItem.id == item_id)

        if bar_id:
            sold_query = sold_query.filter(bar_models.BarSale.bar_id == bar_id)

        if start_date:
            sold_query = sold_query.filter(bar_models.BarSale.sale_date >= start_date)

        if end_date:
            sold_query = sold_query.filter(bar_models.BarSale.sale_date <= end_date)

        sold_query = sold_query.group_by(
            bar_models.BarInventory.item_id,
            bar_models.BarSale.bar_id,
        )

        sold_data = {
            (row.item_id, row.bar_id): float(row.total_sold or 0)
            for row in sold_query.all()
        }

        # =============================================================
        # 3️⃣ ADJUSTED ITEMS (Bar Inventory Adjustments)
        # =============================================================
        adjusted_query = (
            db.query(
                bar_models.BarInventoryAdjustment.item_id,
                bar_models.BarInventoryAdjustment.bar_id,
                func.sum(bar_models.BarInventoryAdjustment.quantity_adjusted)
                .label("total_adjusted"),
            )
            .join(
                store_models.StoreItem,
                bar_models.BarInventoryAdjustment.item_id == store_models.StoreItem.id
            )
            .filter(
                bar_models.BarInventoryAdjustment.business_id == effective_business_id,
                store_models.StoreItem.business_id == effective_business_id
            )
        )

        if item_id:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.item_id == item_id)

        if bar_id:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.bar_id == bar_id)

        if start_date:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.adjusted_at >= start_date)

        if end_date:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.adjusted_at <= end_date)

        adjusted_query = adjusted_query.group_by(
            bar_models.BarInventoryAdjustment.item_id,
            bar_models.BarInventoryAdjustment.bar_id,
        )

        adjusted_data = {
            (row.item_id, row.bar_id): float(row.total_adjusted or 0)
            for row in adjusted_query.all()
        }

        # =============================================================
        # 4️⃣ MERGE + CALCULATE BALANCE
        # =============================================================
        all_keys = set(issued_data.keys()) | set(sold_data.keys()) | set(adjusted_data.keys())
        results = []

        for (i_id, b_id) in all_keys:

            if b_id is None:
                continue

            issued = issued_data.get((i_id, b_id), 0)
            sold = sold_data.get((i_id, b_id), 0)
            adjusted = adjusted_data.get((i_id, b_id), 0)

            balance = issued - sold - adjusted

            item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == i_id,
                store_models.StoreItem.business_id == effective_business_id
            ).first()

            if not item or item.item_type != "bar":
                continue

            bar = db.query(bar_models.Bar).filter(
                bar_models.Bar.id == b_id,
                bar_models.Bar.business_id == effective_business_id
            ).first()

            latest_entry = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.item_id == i_id,
                    store_models.StoreStockEntry.business_id == effective_business_id
                )
                .order_by(
                    store_models.StoreStockEntry.purchase_date.desc(),
                    store_models.StoreStockEntry.id.desc()
                )
                .first()
            )

            unit_price = float(latest_entry.unit_price) if latest_entry and latest_entry.unit_price else None
            balance_total_amount = round(balance * unit_price, 2) if unit_price else None

            results.append(
                bar_schemas.BarStockBalance(
                    bar_id=b_id,
                    bar_name=bar.name if bar else "Unknown",
                    item_id=i_id,
                    item_name=item.name,
                    category_name=item.category.name if item.category else "Uncategorized",
                    item_type=item.item_type,
                    unit=item.unit,
                    total_received=issued,
                    total_sold=sold,
                    total_adjusted=adjusted,
                    balance=balance,
                    last_unit_price=unit_price,
                    balance_total_amount=balance_total_amount,
                )
            )

        results.sort(key=lambda x: (x.bar_name.lower(), x.item_name.lower()))
        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve bar stock balance: {str(e)}"
        )






@router.get("/kitchen-balance-stock", response_model=List[kitchen_schemas.KitchenStockBalance])
def get_kitchen_stock_balance(
    item_id: Optional[int] = Query(None),
    kitchen_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant", "admin", "super_admin"]))
):
    try:

        roles = [r.lower() for r in current_user.roles]

        # ============================================
        # Resolve business
        # ============================================
        if "super_admin" in roles:
            effective_business_id = business_id if business_id else current_user.business_id
        else:
            effective_business_id = current_user.business_id

        # ============================================
        # Validate kitchen_id
        # ============================================
        if kitchen_id:
            try:
                kitchen_id = int(kitchen_id)
            except ValueError:
                raise HTTPException(400, "kitchen_id must be an integer")

        # ============================================
        # 1️⃣ TOTAL ISSUED TO KITCHEN
        # ============================================
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.kitchen_id,
                func.sum(store_models.StoreIssueItem.quantity).label("total_issued")
            )
            .join(store_models.StoreIssue)
            .join(store_models.StoreItem)
            .filter(
                store_models.StoreIssue.issue_to == "kitchen",
                store_models.StoreIssue.business_id == effective_business_id,
                store_models.StoreItem.business_id == effective_business_id
            )
        )

        if item_id:
            issued_query = issued_query.filter(store_models.StoreIssueItem.item_id == item_id)

        if kitchen_id:
            issued_query = issued_query.filter(store_models.StoreIssue.kitchen_id == kitchen_id)

        if start_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issue_date >= start_date)

        if end_date:
            issued_query = issued_query.filter(store_models.StoreIssue.issue_date <= end_date)

        issued_query = issued_query.group_by(
            store_models.StoreIssueItem.item_id,
            store_models.StoreIssue.kitchen_id
        )

        issued_data = {
            (row.item_id, row.kitchen_id): float(row.total_issued or 0)
            for row in issued_query.all()
        }

        # ============================================
        # 2️⃣ TOTAL USED BY KITCHEN (Meal Orders)
        # ============================================
        used_query = (
            db.query(
                restaurant_models.MealOrderItem.store_item_id.label("item_id"),
                restaurant_models.MealOrder.kitchen_id.label("kitchen_id"),
                func.sum(restaurant_models.MealOrderItem.store_qty_used).label("total_used")
            )
            .join(
                restaurant_models.MealOrder,
                restaurant_models.MealOrder.id == restaurant_models.MealOrderItem.order_id
            )
            .filter(
                restaurant_models.MealOrder.business_id == effective_business_id
            )
        )

        if item_id:
            used_query = used_query.filter(restaurant_models.MealOrderItem.store_item_id == item_id)

        if kitchen_id:
            used_query = used_query.filter(restaurant_models.MealOrder.kitchen_id == kitchen_id)

        if start_date:
            used_query = used_query.filter(restaurant_models.MealOrder.created_at >= start_date)

        if end_date:
            used_query = used_query.filter(restaurant_models.MealOrder.created_at <= end_date)

        used_query = used_query.group_by(
            restaurant_models.MealOrderItem.store_item_id,
            restaurant_models.MealOrder.kitchen_id
        )

        used_data = {
            (row.item_id, row.kitchen_id): float(row.total_used or 0)
            for row in used_query.all()
        }

        # ============================================
        # 3️⃣ TOTAL ADJUSTED
        # ============================================
        adjusted_query = (
            db.query(
                kitchen_models.KitchenInventoryAdjustment.item_id,
                kitchen_models.KitchenInventoryAdjustment.kitchen_id,
                func.sum(kitchen_models.KitchenInventoryAdjustment.quantity_adjusted).label("total_adjusted")
            )
            .filter(
                kitchen_models.KitchenInventoryAdjustment.business_id == effective_business_id
            )
        )

        if item_id:
            adjusted_query = adjusted_query.filter(kitchen_models.KitchenInventoryAdjustment.item_id == item_id)

        if kitchen_id:
            adjusted_query = adjusted_query.filter(kitchen_models.KitchenInventoryAdjustment.kitchen_id == kitchen_id)

        if start_date:
            adjusted_query = adjusted_query.filter(kitchen_models.KitchenInventoryAdjustment.adjusted_at >= start_date)

        if end_date:
            adjusted_query = adjusted_query.filter(kitchen_models.KitchenInventoryAdjustment.adjusted_at <= end_date)

        adjusted_query = adjusted_query.group_by(
            kitchen_models.KitchenInventoryAdjustment.item_id,
            kitchen_models.KitchenInventoryAdjustment.kitchen_id
        )

        adjusted_data = {
            (row.item_id, row.kitchen_id): float(row.total_adjusted or 0)
            for row in adjusted_query.all()
        }

        # ============================================
        # 4️⃣ MERGE + CALCULATE BALANCE
        # ============================================
        all_keys = set(issued_data.keys()) | set(used_data.keys()) | set(adjusted_data.keys())

        results = []

        for (i_id, k_id) in all_keys:

            total_issued = issued_data.get((i_id, k_id), 0)
            total_used = used_data.get((i_id, k_id), 0)
            total_adjusted = adjusted_data.get((i_id, k_id), 0)

            balance = total_issued - total_used - total_adjusted

            item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == i_id,
                store_models.StoreItem.business_id == effective_business_id
            ).first()

            kitchen = db.query(kitchen_models.Kitchen).filter(
                kitchen_models.Kitchen.id == k_id,
                kitchen_models.Kitchen.business_id == effective_business_id
            ).first()

            if not item or not kitchen:
                continue

            latest_entry = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.item_id == i_id,
                    store_models.StoreStockEntry.business_id == effective_business_id
                )
                .order_by(
                    store_models.StoreStockEntry.purchase_date.desc(),
                    store_models.StoreStockEntry.id.desc()
                )
                .first()
            )

            unit_price = float(latest_entry.unit_price) if latest_entry else None
            balance_total_amount = round(balance * unit_price, 2) if unit_price else None

            results.append(
                kitchen_schemas.KitchenStockBalance(
                    kitchen_id=k_id,
                    kitchen_name=kitchen.name,
                    item_id=i_id,
                    item_name=item.name,
                    category_name=item.category.name if item.category else None,
                    unit=item.unit,
                    item_type=item.item_type,
                    total_issued=total_issued,
                    total_used=total_used,
                    total_adjusted=total_adjusted,
                    balance=balance,
                    last_unit_price=unit_price,
                    balance_total_amount=balance_total_amount
                )
            )

        results.sort(key=lambda x: (x.kitchen_name.lower(), x.item_name.lower()))

        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve kitchen stock balance: {str(e)}"
        )

# ----------------------------


@router.get("/balance-stock", response_model=list[store_schemas.StoreStockBalance])
def get_store_balances(
    category_id: Optional[int] = Query(None),
    item_type: Optional[str] = Query(None),   # ✔ Filter by item type
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin", "super_admin"]))
):
    # --------------------------------------------------
    # Determine effective business
    # --------------------------------------------------
    roles = [r.lower() for r in current_user.roles]
    effective_business_id = current_user.business_id
    if "super_admin" in roles and business_id:
        effective_business_id = business_id

    # --------------------------------------------------
    # 1️⃣ Historical Adjustments
    # --------------------------------------------------
    adjustments_q = (
        db.query(
            store_models.StoreInventoryAdjustment.item_id,
            func.coalesce(func.sum(store_models.StoreInventoryAdjustment.quantity_adjusted), 0)
            .label("total_adjusted")
        )
        .filter(store_models.StoreInventoryAdjustment.business_id == effective_business_id)
        .group_by(store_models.StoreInventoryAdjustment.item_id)
        .all()
    )
    adjustment_map = {row.item_id: float(row.total_adjusted) for row in adjustments_q}

    # --------------------------------------------------
    # 2️⃣ Store Issues
    # --------------------------------------------------
    issued_q = (
        db.query(
            store_models.StoreIssueItem.item_id,
            func.coalesce(func.sum(store_models.StoreIssueItem.quantity), 0).label("total_issued")
        )
        .join(store_models.StoreIssue)
        .filter(store_models.StoreIssue.business_id == effective_business_id)
        .group_by(store_models.StoreIssueItem.item_id)
        .all()
    )
    issued_map = {row.item_id: float(row.total_issued) for row in issued_q}

    # --------------------------------------------------
    # 3️⃣ Restaurant usage
    # --------------------------------------------------
    restaurant_issued_q = (
        db.query(
            restaurant_models.MealOrderItem.store_item_id.label("item_id"),
            func.coalesce(func.sum(restaurant_models.MealOrderItem.store_qty_used), 0)
            .label("restaurant_issued")
        )
        .join(
            restaurant_models.MealOrder,
            restaurant_models.MealOrder.id == restaurant_models.MealOrderItem.order_id
        )
        .filter(
            restaurant_models.MealOrder.business_id == effective_business_id,
            restaurant_models.MealOrder.status == "closed"
        )
        .group_by(restaurant_models.MealOrderItem.store_item_id)
        .all()
    )
    for row in restaurant_issued_q:
        issued_map[row.item_id] = issued_map.get(row.item_id, 0) + float(row.restaurant_issued)

    # --------------------------------------------------
    # 4️⃣ Store Items + Stock Received
    # --------------------------------------------------
    query = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.unit.label("unit"),
            store_models.StoreItem.item_type.label("item_type"),
            store_models.StoreCategory.name.label("category_name"),
            func.coalesce(func.sum(store_models.StoreStockEntry.original_quantity), 0)
            .label("total_received")
        )
        .join(store_models.StoreStockEntry, store_models.StoreItem.id == store_models.StoreStockEntry.item_id)
        .join(store_models.StoreCategory, store_models.StoreItem.category_id == store_models.StoreCategory.id)
        .filter(store_models.StoreItem.business_id == effective_business_id)
        .group_by(
            store_models.StoreItem.id,
            store_models.StoreItem.name,
            store_models.StoreItem.unit,
            store_models.StoreItem.item_type,
            store_models.StoreCategory.name
        )
        .order_by(store_models.StoreItem.name.asc())
    )

    if category_id:
        query = query.filter(store_models.StoreItem.category_id == category_id)

    if item_type:
        query = query.filter(func.lower(store_models.StoreItem.item_type) == item_type.lower())

    items_q = query.all()

    # --------------------------------------------------
    # 5️⃣ Build response
    # --------------------------------------------------
    response = []

    # Fetch all latest stock entries once
    latest_entries = (
        db.query(
            store_models.StoreStockEntry.item_id,
            store_models.StoreStockEntry.unit_price
        )
        .filter(store_models.StoreStockEntry.business_id == effective_business_id)
        .order_by(store_models.StoreStockEntry.item_id, store_models.StoreStockEntry.purchase_date.desc())
        .distinct(store_models.StoreStockEntry.item_id)
        .all()
    )
    latest_price_map = {entry.item_id: float(entry.unit_price or 0) for entry in latest_entries}

    for item in items_q:
        total_adjusted = adjustment_map.get(item.item_id, 0)
        total_issued = issued_map.get(item.item_id, 0)
        balance_qty = max(float(item.total_received or 0) - total_issued - total_adjusted, 0)
        current_unit_price = latest_price_map.get(item.item_id, 0)
        balance_value = round(balance_qty * current_unit_price, 2)

        response.append(
            store_schemas.StoreStockBalance(
                item_id=item.item_id,
                item_name=item.item_name,
                category_name=item.category_name,
                item_type=item.item_type,
                unit=item.unit,
                total_received=float(item.total_received or 0),
                total_issued=total_issued,
                total_adjusted=total_adjusted,
                balance=balance_qty,
                current_unit_price=current_unit_price,
                balance_total_amount=balance_value
            )
        )

    return response
