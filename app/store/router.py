from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
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

#from app.bar.models import BarSale, BarSaleItem # adjust if your model paths differ
#from app.bar.schemas import BarStockBalance   # if you created a schema for response





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



from sqlalchemy.orm import selectinload

router = APIRouter()

# ----------------------------
# CATEGORY ROUTES
# ----------------------------

@router.post("/categories", response_model=store_schemas.StoreCategoryDisplay)
def create_category(
    category: store_schemas.StoreCategoryCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    existing = db.query(store_models.StoreCategory).filter_by(name=category.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    new_cat = store_models.StoreCategory(**category.dict())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


@router.get("/categories", response_model=list[store_schemas.StoreCategoryDisplay])
def list_categories(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    return db.query(store_models.StoreCategory).all()


@router.put("/categories/{category_id}", response_model=store_schemas.StoreCategoryDisplay)
def update_category(
    category_id: int,
    update_data: store_schemas.StoreCategoryCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    category = db.query(store_models.StoreCategory).filter_by(id=category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    existing = db.query(store_models.StoreCategory).filter(
        store_models.StoreCategory.name == update_data.name,
        store_models.StoreCategory.id != category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    category.name = update_data.name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    category = db.query(store_models.StoreCategory).filter_by(id=category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
    return {"detail": "Category deleted successfully"}



# ----------------------------
# ITEM ROUTES
# ----------------------------

@router.post("/items", response_model=store_schemas.StoreItemDisplay)
def create_item(
    item: store_schemas.StoreItemCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        existing = db.query(store_models.StoreItem).filter_by(name=item.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Item already exists")
        new_item = store_models.StoreItem(**item.dict())
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        return new_item
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")



@router.get("/items", response_model=list[store_schemas.StoreItemDisplay])
def list_items(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        # Subquery to get latest stock entry for each item
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
        )

        # -------------------------------------------------------
        # 🔥 category filter (unchanged) — optional, works as before
        # -------------------------------------------------------
        if category:
            query = (
                query.join(store_models.StoreItem.category)
                .filter(StoreCategory.name == category)
            )

        results = query.order_by(store_models.StoreItem.id.asc()).all()

        items = []
        for item, unit_price in results:
            items.append(store_schemas.StoreItemDisplay(
                id=item.id,
                name=item.name,
                unit=item.unit,
                category=item.category,
                unit_price=unit_price or 0.0,
                created_at=item.created_at,
                item_type=item.item_type      # 🔥 NEW FIELD
            ))

        return items

    except Exception as e:
        print("💥 Error:", e)
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/store-items")
def list_store_items(category: str = None, db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "restaurant"]))):

    query = db.query(store_models.StoreItem)

    if category:
        query = query.filter(store_models.StoreItem.category == category)

    return query.order_by(store_models.StoreItem.name.asc()).all()


@router.get("/items/simple", response_model=List[store_schemas.StoreItemOut])
def list_items_simple(
    db: Session = Depends(get_db),
):
    try:
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
            .order_by(store_models.StoreItem.id.asc())
        )

        results = query.all()

        items = []
        for item, unit_price in results:
            items.append(store_schemas.StoreItemOut(
                id=item.id,
                name=item.name,
                unit=item.unit,
                unit_price=unit_price or 0.0,
                category_id=item.category_id,
                item_type=item.item_type   # 🔥 FIX
            ))

        return items

    except Exception as e:
        print("❌ Error in /items/simple:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch items.")



@router.put("/items/{item_id}", response_model=store_schemas.StoreItemDisplay)
def update_item(
    item_id: int,
    update_data: store_schemas.StoreItemCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    item = db.query(store_models.StoreItem).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = db.query(store_models.StoreItem).filter(
        store_models.StoreItem.name == update_data.name,
        store_models.StoreItem.id != item_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item name already exists")

    for field, value in update_data.dict().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    ccurrent_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    item = db.query(store_models.StoreItem).filter_by(id=item_id).first()
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
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Validate item existence
    item = db.query(store_models.StoreItem).filter_by(id=entry.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

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
    start_date: date = Query(None),
    end_date: date = Query(None),
    invoice_number: str = Query(None),
    vendor_name: str = Query(None),  # ✅ NEW: filter by vendor name
    vendor_id: int = Query(None),    # ✅ Optional: also allow vendor_id
    request: Request = None,  
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    query = db.query(store_models.StoreStockEntry).options(
        selectinload(store_models.StoreStockEntry.vendor),
        selectinload(store_models.StoreStockEntry.item),
    )

    # 🔎 Apply filters
    if start_date and end_date:
        query = query.filter(
            store_models.StoreStockEntry.purchase_date >= start_date,
            store_models.StoreStockEntry.purchase_date <= end_date
        )
    elif start_date:
        query = query.filter(store_models.StoreStockEntry.purchase_date >= start_date)
    elif end_date:
        query = query.filter(store_models.StoreStockEntry.purchase_date <= end_date)

    if invoice_number:
        query = query.filter(store_models.StoreStockEntry.invoice_number.ilike(f"%{invoice_number}%"))

    # ✅ Filter by vendor ID
    if vendor_id:
        query = query.filter(store_models.StoreStockEntry.vendor_id == vendor_id)

    # ✅ Filter by vendor name (case-insensitive)
    if vendor_name:
        query = query.join(store_models.StoreStockEntry.vendor).filter(
            vendor_models.Vendor.business_name.ilike(f"%{vendor_name}%")
        )

    # ✅ Sort latest first
    purchases = query.order_by(store_models.StoreStockEntry.created_at.desc()).all()

    # 🧮 Prepare results
    results, total_amount = [], 0
    for purchase in purchases:
        attachment_url = None
        if purchase.attachment:
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

@router.put("/purchases/{entry_id}", response_model=store_schemas.UpdatePurchase)
async def update_purchase(
    entry_id: int,
    item_id: int = Form(...),
    item_name: str = Form(...),
    invoice_number: str = Form(...),
    quantity: float = Form(...),  # this is the new ORIGINAL quantity (total purchased)
    unit_price: float = Form(...),
    vendor_id: Optional[int] = Form(None),
    purchase_date: datetime = Form(...),
    attachment: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Load the existing stock entry
    entry = db.query(store_models.StoreStockEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found")

    # Ensure target item exists
    item = db.query(store_models.StoreItem).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Calculate how many units have already been consumed (issued) from this stock entry
    old_original = float(entry.original_quantity or 0)
    old_remaining = float(entry.quantity or 0)
    already_issued = old_original - old_remaining
    if already_issued < 0:
        # defensive: if DB somehow inconsistent, treat issued as 0 but log (optional)
        already_issued = 0

    # If item is being changed, disallow if some units from this entry were already issued
    if item_id != entry.item_id and already_issued > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot change item for a purchase that already has issued quantity. Create a new purchase instead."
        )

    # New original quantity is the 'quantity' form field.
    new_original = float(quantity)

    # If new original is less than already issued -> reject (prevents negative remaining)
    if new_original < already_issued:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce purchase quantity below amount already issued ({int(already_issued)}). Use inventory adjustment instead."
        )

    # Compute new remaining quantity on this stock entry after the update
    new_remaining = new_original - already_issued

    # Handle optional attachment update
    if attachment:
        upload_dir = "uploads/store_invoices"
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{attachment.filename}"
        file_location = os.path.join(upload_dir, filename)

        with open(file_location, "wb") as f:
            f.write(await attachment.read())

        entry.attachment = file_location

    # Normalize purchase_date (remove tzinfo if present)
    if hasattr(purchase_date, "tzinfo") and purchase_date.tzinfo is not None:
        purchase_date = purchase_date.replace(tzinfo=None)

    # Overwrite fields safely
    entry.item_id = item_id
    entry.item_name = item_name
    entry.invoice_number = invoice_number
    entry.original_quantity = new_original
    entry.quantity = new_remaining
    entry.unit_price = unit_price
    entry.vendor_id = vendor_id
    entry.purchase_date = purchase_date
    entry.total_amount = (new_original * unit_price) if unit_price is not None else None

    # Do NOT overwrite created_by (preserve who created the entry)
    # Optionally set updated_by/updated_at if your model supports it:
    if hasattr(entry, "updated_by"):
        entry.updated_by = current_user.username
    if hasattr(entry, "updated_at"):
        entry.updated_at = datetime.now()

    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Load related item & vendor for response
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


@router.delete("/purchases/{entry_id}")
def delete_purchase(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # Fetch purchase entry
    entry = db.query(store_models.StoreStockEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found")

    # ❗ SAFETY CHECK:
    # If quantity < original_quantity, some of this stock has been issued
    if entry.quantity < entry.original_quantity:
        issued_amount = entry.original_quantity - entry.quantity
        raise HTTPException(
            status_code=400,
            detail=f"❌ Cannot delete this purchase. {issued_amount} unit(s) "
                   "from this purchase have already been issued to a bar. "
                   "Delete the issue transactions first."
        )

    # Safe to delete
    db.delete(entry)
    db.commit()

    return {"detail": "✅ Purchase entry deleted successfully"}



# ----------------------------
# ISSUE TO BAR (Update BarInventory)
# ----------------------------



from datetime import datetime, date




@router.post("/kitchen", response_model=IssueToKitchenDisplay)
def issue_kitchen(
    issue_data: IssueToKitchenCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    today = date.today()

    # 1️⃣ Date restriction
    if issue_data.issue_date.date() != today and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=400,
            detail="❌ Only admins can post issues for a past date."
        )

    # 2️⃣ Create StoreIssue
    issue = store_models.StoreIssue(
        issue_to="kitchen",
        issued_by_id=current_user.id,
        kitchen_id=issue_data.kitchen_id,
        issue_date=issue_data.issue_date or datetime.utcnow()
    )
    db.add(issue)
    db.flush()  # get issue.id

    # 3️⃣ Loop through each issued item
    issue_items_display: List[IssueToKitchenItemDisplay] = []

    for item_data in issue_data.issue_items:
        # --- Check store stock available ---
        total_available_stock = db.query(func.sum(store_models.StoreStockEntry.quantity)) \
            .filter(store_models.StoreStockEntry.item_id == item_data.item_id) \
            .scalar() or 0

        if total_available_stock < item_data.quantity:
            raise HTTPException(
                400, detail=f"Not enough inventory for item ID {item_data.item_id}"
            )

        # --- Create StoreIssueItem ---
        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity
        )
        db.add(issue_item)

        # --- Deduct store stock (FIFO) ---
        remaining = item_data.quantity
        stock_entries = db.query(store_models.StoreStockEntry) \
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.quantity > 0
            ).order_by(store_models.StoreStockEntry.purchase_date.asc()) \
            .all()

        for entry in stock_entries:
            if remaining <= 0:
                break
            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # --- Update kitchen inventory ---
        kitchen_inventory = db.query(kitchen_models.KitchenInventory).filter_by(
            kitchen_id=issue.kitchen_id,
            item_id=item_data.item_id
        ).first()

        if kitchen_inventory:
            kitchen_inventory.quantity += item_data.quantity
        else:
            kitchen_inventory = kitchen_models.KitchenInventory(
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity
            )
            db.add(kitchen_inventory)

        # --- Prepare display item (minimal) ---
        item_obj = db.query(store_models.StoreItem).filter_by(id=item_data.item_id).first()
        display_item = IssueToKitchenItemDisplay(
            item=KitchenItemMinimalDisplay(
                id=item_data.item_id,
                name=item_obj.name if item_obj else None
            ),
            quantity=item_data.quantity
        )
        issue_items_display.append(display_item)

    # 4️⃣ Commit all changes
    db.commit()
    db.refresh(issue)

    # 5️⃣ Load kitchen object for response
    kitchen_obj = db.query(kitchen_models.Kitchen).filter_by(id=issue.kitchen_id).first()
    kitchen_display = KitchenDisplaySimple(
        id=kitchen_obj.id,
        name=kitchen_obj.name
    )

    # 6️⃣ Return display schema
    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=kitchen_display,
        issue_items=issue_items_display,
        issue_date=issue.issue_date
    )


@router.get("/kitchen", response_model=List[IssueToKitchenDisplay])
def list_kitchen_issues(
    kitchen_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    query = db.query(store_models.StoreIssue).filter(store_models.StoreIssue.issue_to == "kitchen")

    if kitchen_id:
        query = query.filter(store_models.StoreIssue.kitchen_id == kitchen_id)
    if start_date:
        query = query.filter(store_models.StoreIssue.issue_date >= start_date)
    if end_date:
        query = query.filter(store_models.StoreIssue.issue_date <= end_date)

    issues = query.order_by(store_models.StoreIssue.issue_date.desc()).all()

    result = []
    for issue in issues:
        kitchen_obj = db.query(kitchen_models.Kitchen).filter_by(id=issue.kitchen_id).first()
        kitchen_display = KitchenDisplaySimple(
            id=kitchen_obj.id,
            name=kitchen_obj.name
        )

        issue_items_display = []
        for issue_item in issue.issue_items:
            item_obj = db.query(store_models.StoreItem).filter_by(id=issue_item.item_id).first()
            issue_items_display.append(
                IssueToKitchenItemDisplay(
                    item=KitchenItemMinimalDisplay(
                        id=issue_item.item_id,
                        name=item_obj.name if item_obj else None
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



@router.put("/kitchen/{issue_id}", response_model=IssueToKitchenDisplay)
def update_kitchen_issue(
    issue_id: int,
    issue_data: IssueToKitchenCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    issue = db.query(store_models.StoreIssue).filter_by(id=issue_id, issue_to="kitchen").first()
    if not issue:
        raise HTTPException(404, "Issue not found")

    # Reverse old stock and kitchen inventory
    for old_item in issue.issue_items:
        # Restore store stock
        stock_entries = db.query(store_models.StoreStockEntry).filter_by(item_id=old_item.item_id).order_by(store_models.StoreStockEntry.purchase_date.asc()).all()
        remaining = old_item.quantity
        for entry in stock_entries:
            entry.quantity += remaining
            remaining = 0
            if remaining <= 0:
                break

        # Reduce kitchen inventory
        kitchen_inv = db.query(kitchen_models.KitchenInventory).filter_by(kitchen_id=issue.kitchen_id, item_id=old_item.item_id).first()
        if kitchen_inv:
            kitchen_inv.quantity -= old_item.quantity

        db.delete(old_item)

    db.flush()

    # Recreate issue items and adjust stock (same as issue_kitchen)
    issue.issue_date = issue_data.issue_date or datetime.utcnow()
    issue.kitchen_id = issue_data.kitchen_id
    issue_items_display = []

    for item_data in issue_data.issue_items:
        total_available_stock = db.query(func.sum(store_models.StoreStockEntry.quantity)).filter_by(item_id=item_data.item_id).scalar() or 0
        if total_available_stock < item_data.quantity:
            raise HTTPException(400, f"Not enough inventory for item ID {item_data.item_id}")

        # Create new StoreIssueItem
        new_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity
        )
        db.add(new_item)

        # Deduct store stock (FIFO)
        remaining = item_data.quantity
        stock_entries = db.query(store_models.StoreStockEntry).filter(store_models.StoreStockEntry.item_id == item_data.item_id, store_models.StoreStockEntry.quantity > 0).order_by(store_models.StoreStockEntry.purchase_date.asc()).all()
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
        kitchen_inv = db.query(kitchen_models.KitchenInventory).filter_by(kitchen_id=issue.kitchen_id, item_id=item_data.item_id).first()
        if kitchen_inv:
            kitchen_inv.quantity += item_data.quantity
        else:
            kitchen_inv = kitchen_models.KitchenInventory(
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity
            )
            db.add(kitchen_inv)

        # Prepare minimal display
        item_obj = db.query(store_models.StoreItem).filter_by(id=item_data.item_id).first()
        issue_items_display.append(
            IssueToKitchenItemDisplay(
                item=KitchenItemMinimalDisplay(
                    id=item_data.item_id,
                    name=item_obj.name if item_obj else None
                ),
                quantity=item_data.quantity
            )
        )

    db.commit()
    db.refresh(issue)

    kitchen_obj = db.query(kitchen_models.Kitchen).filter_by(id=issue.kitchen_id).first()
    kitchen_display = KitchenDisplaySimple(id=kitchen_obj.id, name=kitchen_obj.name)

    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=kitchen_display,
        issue_items=issue_items_display,
        issue_date=issue.issue_date
    )



@router.get("/store/kitchen-items", response_model=List[StoreItemDisplay])
def list_kitchen_items(db: Session = Depends(get_db)):
    """
    List all store items that are kitchen items.
    Filter directly by item_type='kitchen'.
    """
    kitchen_items = db.query(StoreItem)\
        .filter(StoreItem.item_type == "kitchen")\
        .order_by(StoreItem.name.asc())\
        .all()
    return kitchen_items

@router.delete("/kitchen/{issue_id}", response_model=dict)
def delete_kitchen_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    issue = db.query(store_models.StoreIssue).filter_by(id=issue_id, issue_to="kitchen").first()
    if not issue:
        raise HTTPException(404, "Issue not found")

    # Restore store stock and kitchen inventory
    for item in issue.issue_items:
        stock_entries = db.query(store_models.StoreStockEntry).filter_by(item_id=item.item_id).order_by(store_models.StoreStockEntry.purchase_date.asc()).all()
        remaining = item.quantity
        for entry in stock_entries:
            entry.quantity += remaining
            remaining = 0
            if remaining <= 0:
                break

        kitchen_inv = db.query(kitchen_models.KitchenInventory).filter_by(kitchen_id=issue.kitchen_id, item_id=item.item_id).first()
        if kitchen_inv:
            kitchen_inv.quantity -= item.quantity

        db.delete(item)

    db.delete(issue)
    db.commit()

    return {"detail": "Kitchen issue deleted successfully"}



@router.post("/bar", response_model=store_schemas.IssueDisplay)
def issue_to_bar(
    issue_data: store_schemas.IssueCreate,  # expects issue_to="bar" and issued_to_id=bar_id
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    today = date.today()

    # ------------------------------
    # 1️⃣ Date restriction
    # ------------------------------
    if issue_data.issue_date.date() != today and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=400,
            detail="❌ Only admins can post issues for a past date."
        )

    # ------------------------------
    # 2️⃣ Create StoreIssue
    # ------------------------------
    issue = store_models.StoreIssue(
        issue_to="bar",
        issued_by_id=current_user.id,
        bar_id=issue_data.issued_to_id,
        issue_date=issue_data.issue_date or datetime.utcnow()
    )
    db.add(issue)
    db.flush()  # assign issue.id

    # ------------------------------
    # 3️⃣ Process each issued item
    # ------------------------------
    issue_items_display: List[store_schemas.IssueItemDisplay] = []

    for item_data in issue_data.issue_items:
        # Check stock availability
        total_available_stock = db.query(func.sum(store_models.StoreStockEntry.quantity)) \
            .filter(store_models.StoreStockEntry.item_id == item_data.item_id) \
            .scalar() or 0

        if total_available_stock < item_data.quantity:
            raise HTTPException(
                400, detail=f"Not enough inventory for item ID {item_data.item_id}"
            )

        # Create StoreIssueItem
        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity
        )
        db.add(issue_item)
        db.flush()  # assign issue_item.id

        # Deduct store stock (FIFO)
        remaining = item_data.quantity
        stock_entries = db.query(store_models.StoreStockEntry) \
            .filter(
                store_models.StoreStockEntry.item_id == item_data.item_id,
                store_models.StoreStockEntry.quantity > 0
            ).order_by(store_models.StoreStockEntry.purchase_date.asc()) \
            .all()

        for entry in stock_entries:
            if remaining <= 0:
                break
            if entry.quantity >= remaining:
                entry.quantity -= remaining
                remaining = 0
            else:
                remaining -= entry.quantity
                entry.quantity = 0

        # Update bar inventory
        bar_inventory = db.query(bar_models.BarInventory).filter_by(
            bar_id=issue.bar_id,
            item_id=item_data.item_id
        ).first()

        if bar_inventory:
            bar_inventory.quantity += item_data.quantity
        else:
            last_stock = db.query(store_models.StoreStockEntry) \
                .filter(store_models.StoreStockEntry.item_id == item_data.item_id) \
                .order_by(store_models.StoreStockEntry.id.desc()) \
                .first()

            bar_inventory = bar_models.BarInventory(
                bar_id=issue.bar_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
                selling_price=last_stock.unit_price if last_stock else 0
            )
            db.add(bar_inventory)

        # Prepare display item
        item_obj = db.query(store_models.StoreItem).filter_by(id=item_data.item_id).first()
        display_item = store_schemas.IssueItemDisplay(
            id=issue_item.id,
            item=store_schemas.StoreItemDisplay(
                id=item_obj.id,
                name=item_obj.name,
                unit=item_obj.unit,
                category=store_schemas.StoreCategoryDisplay(
                    id=item_obj.category.id,
                    name=item_obj.category.name,               # <-- FIXED
                    created_at=item_obj.category.created_at
                ) if item_obj.category else None,
                unit_price=item_obj.unit_price,
                created_at=item_obj.created_at
            ),
            quantity=item_data.quantity
        )


        issue_items_display.append(display_item)

    # ------------------------------
    # 4️⃣ Commit changes
    # ------------------------------
    db.commit()
    db.refresh(issue)

    # ------------------------------
    # 5️⃣ Load bar object for response
    # ------------------------------
    bar_obj = db.query(store_models.Bar).filter_by(id=issue.bar_id).first()

    # ------------------------------
    # 6️⃣ Return IssueDisplay
    # ------------------------------
    return store_schemas.IssueDisplay(
        id=issue.id,
        issue_to="bar",
        issued_to_id=issue.bar_id,
        issued_to=bar_obj,
        issue_date=issue.issue_date,
        issue_items=issue_items_display
    )



@router.get("/bar", response_model=List[store_schemas.IssueDisplay])
def list_issues_to_bar(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    issues = db.query(store_models.StoreIssue).filter_by(issue_to="bar").order_by(
        store_models.StoreIssue.issue_date.desc()
    ).all()

    result: List[store_schemas.IssueDisplay] = []

    for issue in issues:
        issue_items_display: List[store_schemas.IssueItemDisplay] = []

        for issue_item in issue.issue_items:  # ✅ fixed
            item_obj = db.query(store_models.StoreItem).filter_by(id=issue_item.item_id).first()
            display_item = store_schemas.IssueItemDisplay(
                id=issue_item.id,
                item=store_schemas.StoreItemDisplay(
                    id=item_obj.id,
                    name=item_obj.name,
                    unit=item_obj.unit,
                    category=store_schemas.StoreCategoryDisplay(
                        id=item_obj.category.id,
                        name=item_obj.category.name,
                        category_name=getattr(item_obj.category, "name", None),
                        created_at=item_obj.category.created_at if item_obj.category else datetime.utcnow()
                    ) if item_obj.category else None,
                    unit_price=item_obj.unit_price,
                    created_at=item_obj.created_at
                ),
                quantity=issue_item.quantity
            )
            issue_items_display.append(display_item)

        bar_obj = db.query(store_models.Bar).filter_by(id=issue.bar_id).first()

        result.append(store_schemas.IssueDisplay(
            id=issue.id,
            issue_to="bar",
            issued_to_id=issue.bar_id,
            issued_to=bar_obj,
            issue_date=issue.issue_date,
            issue_items=issue_items_display
        ))

    return result


@router.get("/stock/{item_id}")
def get_item_stock(item_id: int, db: Session = Depends(get_db)):
    total = (
        db.query(func.sum(StoreStockEntry.quantity))
        .filter(StoreStockEntry.item_id == item_id)
        .scalar()
    ) or 0
    return {"item_id": item_id, "available": total}


@router.put("/bar-issues/{issue_id}", response_model=store_schemas.IssueDisplay)
def update_bar_issue(
    issue_id: int,
    update_data: store_schemas.IssueCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Fetch the existing issue
    issue = db.query(store_models.StoreIssue).filter_by(id=issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.issue_to.lower() != "bar":
        raise HTTPException(status_code=400, detail="This endpoint only updates bar issues")

    # ---------------------------
    # 1️⃣ RESTORE OLD ITEMS
    # ---------------------------
    old_items = issue.issue_items  # correct relationship
    for old in old_items:
        qty_to_restore = old.quantity

        # Restore FIFO stock entries
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(store_models.StoreStockEntry.item_id == old.item_id)
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )

        for entry in stock_entries:
            if qty_to_restore <= 0:
                break
            entry.quantity += qty_to_restore
            qty_to_restore = 0

        # Restore bar inventory
        bar_inv = (
            db.query(bar_models.BarInventory)
            .filter_by(bar_id=issue.bar_id, item_id=old.item_id)
            .first()
        )
        if bar_inv:
            bar_inv.quantity -= old.quantity
            if bar_inv.quantity < 0:
                bar_inv.quantity = 0

    # Delete old issue items
    db.query(store_models.StoreIssueItem).filter_by(issue_id=issue_id).delete()

    # ---------------------------
    # 2️⃣ VALIDATE NEW ITEMS
    # ---------------------------
    old_issue_map = {old.item_id: old.quantity for old in old_items}

    for item in update_data.issue_items:
        requested_qty = item.quantity
        available = (
            db.query(func.sum(store_models.StoreStockEntry.quantity))
            .filter(store_models.StoreStockEntry.item_id == item.item_id)
            .scalar()
        ) or 0
        old_qty = old_issue_map.get(item.item_id, 0)
        allowed = available + old_qty

        if requested_qty > allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for item {item.item_id}. Requested {requested_qty}, available {allowed}"
            )

    # ---------------------------
    # 3️⃣ UPDATE ISSUE HEADER
    # ---------------------------
    issue.issue_date = update_data.issue_date or datetime.utcnow()
    issue.issued_to_id = update_data.issued_to_id
    issue.issued_by_id = current_user.id

    # ---------------------------
    # 4️⃣ DEDUCT STOCK & SAVE NEW ITEMS
    # ---------------------------
    for item in update_data.issue_items:
        qty_to_deduct = item.quantity

        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(store_models.StoreStockEntry.item_id == item.item_id, store_models.StoreStockEntry.quantity > 0)
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )

        for entry in stock_entries:
            if qty_to_deduct <= 0:
                break
            if entry.quantity >= qty_to_deduct:
                entry.quantity -= qty_to_deduct
                qty_to_deduct = 0
            else:
                qty_to_deduct -= entry.quantity
                entry.quantity = 0

        # Update or create bar inventory
        bar_inv = (
            db.query(bar_models.BarInventory)
            .filter_by(bar_id=update_data.issued_to_id, item_id=item.item_id)
            .first()
        )
        if bar_inv:
            bar_inv.quantity += item.quantity
        else:
            bar_inv = bar_models.BarInventory(
                bar_id=update_data.issued_to_id,
                item_id=item.item_id,
                quantity=item.quantity,
                selling_price=0
            )
            db.add(bar_inv)

        # Save new issue item
        new_item = store_models.StoreIssueItem(
            issue_id=issue_id,
            item_id=item.item_id,
            quantity=item.quantity
        )
        db.add(new_item)

    db.commit()
    db.refresh(issue)

    # ---------------------------
    # 5️⃣ RETURN ISSUE DISPLAY (frontend-ready)
    # ---------------------------
    issue_items_display: List[store_schemas.IssueItemDisplay] = []
    for issue_item in issue.issue_items:
        item_obj = db.query(store_models.StoreItem).filter_by(id=issue_item.item_id).first()
        display_item = store_schemas.IssueItemDisplay(
            id=issue_item.id,
            item=store_schemas.StoreItemDisplay(
                id=item_obj.id,
                name=item_obj.name,
                unit=item_obj.unit,
                category=store_schemas.StoreCategoryDisplay(
                    id=item_obj.category.id,
                    name=item_obj.category.name,
                    category_name=getattr(item_obj.category, "name", None),
                    created_at=item_obj.category.created_at if item_obj.category else datetime.utcnow()
                ) if item_obj.category else None,
                unit_price=item_obj.unit_price,
                created_at=item_obj.created_at
            ),
            quantity=issue_item.quantity
        )
        issue_items_display.append(display_item)

    bar_obj = db.query(store_models.Bar).filter_by(id=issue.bar_id).first()

    return store_schemas.IssueDisplay(
        id=issue.id,
        issue_to="bar",
        issued_to_id=issue.bar_id,
        issued_to=bar_obj,
        issue_date=issue.issue_date,
        issue_items=issue_items_display
    )




@router.delete("/bar-issues/{issue_id}")
def delete_bar_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # 1️⃣ Fetch the issue
    issue = db.query(store_models.StoreIssue).filter_by(id=issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.issue_to.lower() != "bar":
        raise HTTPException(status_code=400, detail="This endpoint only deletes bar issues")

    # 2️⃣ Fetch all issue items
    issue_items = issue.issue_items  # use the relationship

    for item in issue_items:
        # Restore stock entries (FIFO)
        stock_entries = (
            db.query(store_models.StoreStockEntry)
            .filter(store_models.StoreStockEntry.item_id == item.item_id)
            .order_by(store_models.StoreStockEntry.purchase_date.asc())
            .all()
        )

        remaining_to_restore = item.quantity
        for stock_entry in stock_entries:
            if remaining_to_restore <= 0:
                break
            stock_entry.quantity += remaining_to_restore
            remaining_to_restore = 0

        # Reduce bar inventory
        bar_inventory = (
            db.query(bar_models.BarInventory)
            .filter_by(bar_id=issue.bar_id, item_id=item.item_id)
            .first()
        )
        if bar_inventory:
            bar_inventory.quantity -= item.quantity
            if bar_inventory.quantity < 0:
                bar_inventory.quantity = 0

    # 3️⃣ Delete all issue items and issue
    db.query(store_models.StoreIssueItem).filter_by(issue_id=issue.id).delete()
    db.delete(issue)

    db.commit()

    return {"detail": "✅ Bar issue deleted and stock restored successfully"}



@router.post("/adjust", response_model=store_schemas.StoreInventoryAdjustmentDisplay)
def adjust_store_inventory(
    adjustment_data: store_schemas.StoreInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # Get latest stock entry
    latest_entry = db.query(store_models.StoreStockEntry).filter(
        store_models.StoreStockEntry.item_id == adjustment_data.item_id,
        store_models.StoreStockEntry.quantity > 0
    ).order_by(store_models.StoreStockEntry.purchase_date.desc()).first()

    if not latest_entry:
        raise HTTPException(status_code=404, detail="Item not found or out of stock.")

    if adjustment_data.quantity_adjusted > latest_entry.quantity:
        raise HTTPException(status_code=400, detail="Adjustment exceeds available stock.")

    # Deduct quantity
    latest_entry.quantity -= adjustment_data.quantity_adjusted
    db.add(latest_entry)

    # Log adjustment
    adjustment = store_models.StoreInventoryAdjustment(
        item_id=adjustment_data.item_id,
        quantity_adjusted=adjustment_data.quantity_adjusted,
        reason=adjustment_data.reason,
        adjusted_by=current_user.username,
        adjusted_at=datetime.utcnow()
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    # Fetch the related item and category
    item_obj = db.query(store_models.StoreItem).filter_by(id=adjustment.item_id).first()
    category_display = None
    if item_obj and item_obj.category:
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
        created_at=item_obj.created_at
    )

    # Build final adjustment display
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
    item_id: Optional[int] = Query(None, description="Filter by specific item"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    query = db.query(store_models.StoreInventoryAdjustment)

    if item_id:
        query = query.filter(store_models.StoreInventoryAdjustment.item_id == item_id)
    if start_date:
        query = query.filter(store_models.StoreInventoryAdjustment.adjusted_at >= start_date)
    if end_date:
        query = query.filter(store_models.StoreInventoryAdjustment.adjusted_at <= end_date)

    adjustments = query.order_by(store_models.StoreInventoryAdjustment.adjusted_at.desc()).all()

    results = []

    for adj in adjustments:
        item_obj = db.query(store_models.StoreItem).filter_by(id=adj.item_id).first()
        category_display = None
        if item_obj and item_obj.category:
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
            created_at=item_obj.created_at
        )

        results.append(store_schemas.StoreInventoryAdjustmentDisplay(
            id=adj.id,
            item=item_display,
            quantity_adjusted=adj.quantity_adjusted,
            reason=adj.reason,
            adjusted_by=adj.adjusted_by,
            adjusted_at=adj.adjusted_at
        ))

    return results




@router.put("/adjustments/{adjustment_id}")
def update_adjustment(
    adjustment_id: int,
    data: StoreInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # AuthZ
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can edit adjustments.")

    # Load existing adjustment
    adjustment = db.query(StoreInventoryAdjustment).filter(
        StoreInventoryAdjustment.id == adjustment_id
    ).first()
    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found.")

    # Helper to get the latest stock entry we mutate for an item
    def latest_entry_for(item_id: int):
        return db.query(StoreStockEntry).filter(
            StoreStockEntry.item_id == item_id
        ).order_by(StoreStockEntry.purchase_date.desc()).first()

    # CASE A: Same item — adjust by delta (new - old)
    if data.item_id == adjustment.item_id:
        entry = latest_entry_for(adjustment.item_id)
        if not entry:
            raise HTTPException(status_code=404, detail=f"No stock entry found for item {adjustment.item_id}")

        old_qty = adjustment.quantity_adjusted          # previously removed from stock
        new_qty = data.quantity_adjusted                # to be removed now
        delta = new_qty - old_qty                       # positive => remove more; negative => return some

        if delta > 0:
            # need to remove extra `delta` from stock
            if entry.quantity < delta:
                raise HTTPException(status_code=400, detail="Adjustment exceeds available stock.")
            entry.quantity -= delta
        elif delta < 0:
            # need to give back -delta to stock
            entry.quantity += (-delta)

        # update adjustment record
        adjustment.quantity_adjusted = new_qty
        adjustment.reason = data.reason

        db.add(entry)
        db.add(adjustment)
        db.commit()
        db.refresh(adjustment)

        return {
            "message": "Adjustment updated successfully.",
            "adjustment": adjustment,
            "current_stock": entry.quantity
        }

    # CASE B: Item changed — restore old item fully, apply new item fully
    # 1) restore OLD
    old_entry = latest_entry_for(adjustment.item_id)
    if not old_entry:
        raise HTTPException(status_code=404, detail=f"No stock entry found for old item {adjustment.item_id}")
    old_entry.quantity += adjustment.quantity_adjusted  # give back everything previously removed

    # 2) apply NEW
    new_entry = latest_entry_for(data.item_id)
    if not new_entry:
        raise HTTPException(status_code=404, detail=f"No stock entry found for new item {data.item_id}")
    if new_entry.quantity < data.quantity_adjusted:
        raise HTTPException(status_code=400, detail="Adjustment exceeds available stock for the new item.")
    new_entry.quantity -= data.quantity_adjusted

    # 3) update adjustment record
    adjustment.item_id = data.item_id
    adjustment.quantity_adjusted = data.quantity_adjusted
    adjustment.reason = data.reason

    db.add(old_entry)
    db.add(new_entry)
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    return {
        "message": "Adjustment updated successfully (item changed).",
        "adjustment": adjustment,
        "old_item_restored_to": old_entry.quantity,
        "new_item_current_stock": new_entry.quantity
    }

@router.delete("/adjustments/{adjustment_id}")
def delete_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # Only admins can delete
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can delete adjustments.")

    # Get adjustment
    adjustment = db.query(StoreInventoryAdjustment)\
        .options(joinedload(StoreInventoryAdjustment.item))\
        .filter(StoreInventoryAdjustment.id == adjustment_id).first()

    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found.")

    # Get latest stock entry for the affected item
    stock_entry = db.query(StoreStockEntry).filter(
        StoreStockEntry.item_id == adjustment.item_id
    ).order_by(StoreStockEntry.purchase_date.desc()).first()

    if not stock_entry:
        raise HTTPException(status_code=404, detail="No stock entry found to restore the quantity.")

    # ✅ Restore the stock to received baseline by ADDING back the adjusted quantity
    stock_entry.quantity += adjustment.quantity_adjusted
    db.add(stock_entry)

    # Delete the adjustment record
    db.delete(adjustment)
    db.commit()

    return {
        "message": "Adjustment deleted successfully.",
        "restored_quantity": adjustment.quantity_adjusted,
        "item_id": adjustment.item_id,
        "current_stock": stock_entry.quantity
    }




@router.get("/bar-balance-stock", response_model=List[bar_schemas.BarStockBalance])
def get_bar_stock_balance(
    item_id: Optional[int] = Query(None, description="Filter by specific item"),
    bar_id: Optional[int] = Query(None, description="Filter by bar"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        # =============================================================
        # 1) ISSUED ITEMS (StoreIssue → Bar)
        # =============================================================
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.bar_id.label("bar_id"),
                func.sum(store_models.StoreIssueItem.quantity).label("total_received"),
            )
            .join(store_models.StoreIssue)
            .join(store_models.StoreItem)
        )

        if item_id:
            issued_query = issued_query.filter(store_models.StoreItem.id == item_id)

        if bar_id:
            issued_query = issued_query.filter(store_models.StoreIssue.bar_id == bar_id)

        issued_query = issued_query.group_by(
            store_models.StoreIssueItem.item_id,
            store_models.StoreIssue.bar_id,
        )

        issued_data = {
            (row.item_id, row.bar_id): {"total_received": float(row.total_received or 0)}
            for row in issued_query.all()
        }

        # =============================================================
        # 2) SOLD ITEMS (BarSales)
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
        )

        if item_id:
            sold_query = sold_query.filter(store_models.StoreItem.id == item_id)
        if bar_id:
            sold_query = sold_query.filter(bar_models.BarSale.bar_id == bar_id)

        sold_query = sold_query.group_by(
            bar_models.BarInventory.item_id,
            bar_models.BarSale.bar_id,
        )

        sold_data = {
            (row.item_id, row.bar_id): float(row.total_sold or 0)
            for row in sold_query.all()
        }

        # =============================================================
        # 3) ADJUSTED ITEMS (BarInventoryAdjustment)
        # =============================================================
        adjusted_query = (
            db.query(
                bar_models.BarInventoryAdjustment.item_id,
                bar_models.BarInventoryAdjustment.bar_id,
                func.sum(bar_models.BarInventoryAdjustment.quantity_adjusted)
                    .label("total_adjusted"),
            )
            .join(store_models.StoreItem, bar_models.BarInventoryAdjustment.item_id == store_models.StoreItem.id)
        )

        if item_id:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.item_id == item_id)
        if bar_id:
            adjusted_query = adjusted_query.filter(bar_models.BarInventoryAdjustment.bar_id == bar_id)

        adjusted_query = adjusted_query.group_by(
            bar_models.BarInventoryAdjustment.item_id,
            bar_models.BarInventoryAdjustment.bar_id,
        )

        adjusted_data = {
            (row.item_id, row.bar_id): float(row.total_adjusted or 0)
            for row in adjusted_query.all()
        }

        # =============================================================
        # 4) Merge all keys (items that appeared anywhere)
        # =============================================================
        all_keys = set(issued_data.keys()) | set(sold_data.keys()) | set(adjusted_data.keys())
        results = []

        for (i_id, b_id) in all_keys:

            # Skip invalid bar_id
            if b_id is None:
                continue

            issued = issued_data.get((i_id, b_id), {"total_received": 0})["total_received"]
            sold = sold_data.get((i_id, b_id), 0)
            adjusted = adjusted_data.get((i_id, b_id), 0)

            balance = issued - sold - adjusted

            # Get item
            item = db.query(store_models.StoreItem).filter(store_models.StoreItem.id == i_id).first()
            if not item:
                continue

            # ----------------------------
            # Exclude kitchen category
            # ----------------------------
            if item.item_type != "bar":
                continue

            # Get bar
            bar = db.query(bar_models.Bar).filter(bar_models.Bar.id == b_id).first()

            # Price lookups
            latest_entry = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.item_id == i_id,
                    store_models.StoreStockEntry.unit_price.isnot(None)
                )
                .order_by(store_models.StoreStockEntry.purchase_date.desc(), store_models.StoreStockEntry.id.desc())
                .first()
            )

            if not latest_entry:
                latest_entry = (
                    db.query(store_models.StoreStockEntry)
                    .filter(store_models.StoreStockEntry.item_id == i_id)
                    .order_by(store_models.StoreStockEntry.purchase_date.desc(), store_models.StoreStockEntry.id.desc())
                    .first()
                )

            unit_price = None
            if latest_entry and latest_entry.unit_price is not None:
                try:
                    unit_price = float(latest_entry.unit_price)
                except:
                    unit_price = float(str(latest_entry.unit_price))

            balance_total_amount = (
                round(balance * unit_price, 2) if unit_price is not None else None
            )

            # Build response row
            results.append(bar_schemas.BarStockBalance(
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
            ))

        # Sort results
        results.sort(key=lambda x: (x.item_name.lower(), x.bar_name.lower()))

        return results



    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stock balance: {str(e)}")






@router.get("/kitchen-balance-stock", response_model=List[kitchen_schemas.KitchenStockBalance])
def get_kitchen_stock_balance(
    item_id: Optional[int] = Query(None),
    kitchen_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        # Convert kitchen_id to int if required
        if kitchen_id:
            try:
                kitchen_id = int(kitchen_id)
            except ValueError:
                raise HTTPException(400, "kitchen_id must be an integer")

        # ============================================
        # 1️⃣ TOTAL ISSUED TO KITCHEN (Store → Kitchen)
        # ============================================
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.kitchen_id,
                func.sum(store_models.StoreIssueItem.quantity).label("total_issued")
            )
            .join(store_models.StoreIssue)
            .filter(store_models.StoreIssue.issue_to == "kitchen")
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
        # 3️⃣ TOTAL ADJUSTED (Kitchen Inventory Adjustments)
        # ============================================
        adjusted_query = (
            db.query(
                kitchen_models.KitchenInventoryAdjustment.item_id,
                kitchen_models.KitchenInventoryAdjustment.kitchen_id,
                func.sum(kitchen_models.KitchenInventoryAdjustment.quantity_adjusted).label("total_adjusted")
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

            item = db.query(store_models.StoreItem).filter_by(id=i_id).first()
            kitchen = db.query(kitchen_models.Kitchen).filter_by(id=k_id).first()

            if not item or not kitchen:
                continue

            # Fetch latest unit price
            latest_entry = (
                db.query(store_models.StoreStockEntry)
                .filter(store_models.StoreStockEntry.item_id == i_id)
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

        # Sort for UI
        results.sort(key=lambda x: (x.kitchen_name.lower(), x.item_name.lower()))
        return results

    except Exception as e:
        raise HTTPException(
            500,
            f"Failed to retrieve kitchen stock balance: {str(e)}"
        )
# ----------------------------


@router.get("/balance-stock", response_model=list[store_schemas.StoreStockBalance])
def get_store_balances(
    category_id: Optional[int] = Query(None),
    item_type: Optional[str] = Query(None),   # ✔ NEW FILTER
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # 1) Historical Adjustments
    adjustments_q = (
        db.query(
            store_models.StoreInventoryAdjustment.item_id,
            func.coalesce(func.sum(store_models.StoreInventoryAdjustment.quantity_adjusted), 0)
            .label("total_adjusted")
        )
        .group_by(store_models.StoreInventoryAdjustment.item_id)
        .all()
    )

    adjustment_map = {row.item_id: float(row.total_adjusted) for row in adjustments_q}

    # 2) Issues from StoreIssueItem
    issued_q = (
        db.query(
            store_models.StoreIssueItem.item_id,
            func.coalesce(func.sum(store_models.StoreIssueItem.quantity), 0).label("total_issued")
        )
        .group_by(store_models.StoreIssueItem.item_id)
        .all()
    )

    issued_map = {row.item_id: float(row.total_issued) for row in issued_q}

    # 3) Restaurant sales also reduce stock
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
        .filter(restaurant_models.MealOrder.status == "closed")
        .group_by(restaurant_models.MealOrderItem.store_item_id)
        .all()
    )

    for row in restaurant_issued_q:
        issued_map[row.item_id] = issued_map.get(row.item_id, 0) + float(row.restaurant_issued)

    # 4) PURCHASES & STOCK (base query)
    query = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.unit.label("unit"),
            store_models.StoreItem.item_type.label("item_type"),  # ✔ FIXED
            store_models.StoreCategory.name.label("category_name"),
            func.coalesce(func.sum(store_models.StoreStockEntry.original_quantity), 0)
            .label("total_received"),
        )
        .join(
            store_models.StoreStockEntry,
            store_models.StoreItem.id == store_models.StoreStockEntry.item_id
        )
        .join(
            store_models.StoreCategory,
            store_models.StoreItem.category_id == store_models.StoreCategory.id
        )
        .order_by(store_models.StoreItem.name.asc())
    )

    # ✔ FILTER BY CATEGORY IF PROVIDED
    if category_id:
        query = query.filter(store_models.StoreItem.category_id == category_id)

    # ✔ FILTER BY ITEM TYPE IF PROVIDED
    if item_type:
        query = query.filter(func.lower(store_models.StoreItem.item_type) == item_type.lower())


    query = query.group_by(
        store_models.StoreItem.id,
        store_models.StoreItem.name,
        store_models.StoreItem.unit,
        store_models.StoreItem.item_type,
        store_models.StoreCategory.name
    )

    items_q = query.all()

    # 5) Build response using schema
    response = []

    for item in items_q:
        latest_entry = (
            db.query(store_models.StoreStockEntry)
            .filter(store_models.StoreStockEntry.item_id == item.item_id)
            .order_by(
                store_models.StoreStockEntry.purchase_date.desc(),
                store_models.StoreStockEntry.id.desc()
            )
            .first()
        )

        current_unit_price = float(latest_entry.unit_price) if latest_entry else 0.0

        total_adjusted = adjustment_map.get(item.item_id, 0)
        total_issued = issued_map.get(item.item_id, 0)

        balance_qty = float(item.total_received or 0) - total_issued - total_adjusted
        if balance_qty < 0:
            balance_qty = 0

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
                balance_total_amount=balance_value,
            )
        )

    return response
