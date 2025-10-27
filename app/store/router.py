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
from app.store import schemas as store_schemas
from app.bar.models import BarInventory 
from app.bar.models import Bar 
from app.store.models import StoreIssue, StoreIssueItem, StoreStockEntry, StoreCategory
from app.vendor import models as vendor_models
from app.store.models import StoreInventoryAdjustment
from app.store.schemas import  StoreInventoryAdjustmentCreate, StoreInventoryAdjustmentDisplay

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



from sqlalchemy.orm import aliased
from sqlalchemy import func, and_
from fastapi import HTTPException

@router.get("/items", response_model=list[store_schemas.StoreItemDisplay])
def list_items(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        # Subquery to get the latest stock entry (with unit_price) for each item
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

        if category:
            query = query.join(store_models.StoreItem.category).filter(StoreCategory.name == category)

        results = query.order_by(store_models.StoreItem.id.asc()).all()

        items = []
        for item, unit_price in results:
            items.append(store_schemas.StoreItemDisplay(
                id=item.id,
                name=item.name,
                unit=item.unit,
                category=item.category,
                unit_price=unit_price or 0.0,  # fallback to 0.0 if None
                created_at=item.created_at
            ))

        return items

    except Exception as e:
        print("💥 Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

from sqlalchemy.orm import aliased
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

@router.get("/items/simple", response_model=List[store_schemas.StoreItemOut])
def list_items_simple(
    db: Session = Depends(get_db),
    #current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        # Subquery to get the latest stock entry (unit_price) for each item
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
                unit_price=unit_price or 0.0  # fallback to 0.0 if None
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
    entry = db.query(store_models.StoreStockEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found")

    db.delete(entry)
    db.commit()
    return {"detail": "Purchase entry deleted successfully"}



# ----------------------------
# ISSUE TO BAR (Update BarInventory)
# ----------------------------

from datetime import datetime, date

@router.post("/issues", response_model=store_schemas.IssueDisplay)
def supply_to_bars(
    issue_data: store_schemas.IssueCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))  # ✅ allow both
):
    today = date.today()

    # ✅ Date Control: only today's date unless admin
    if issue_data.issue_date and issue_data.issue_date.date() != today:
        if "admin" not in current_user.roles:  # ✅ check list of roles
            raise HTTPException(
                status_code=400,
                detail="❌ Only admins can post issues for a past date."
            )

    issue = StoreIssue(
        issue_to=issue_data.issue_to,
        issued_to_id=issue_data.issued_to_id,
        issued_by_id=current_user.id,
        issue_date=issue_data.issue_date or datetime.utcnow(),
    )
    db.add(issue)
    db.flush()

    for item_data in issue_data.issue_items:
        total_available_stock = db.query(func.sum(StoreStockEntry.quantity))\
            .filter(StoreStockEntry.item_id == item_data.item_id)\
            .scalar() or 0

        if total_available_stock < item_data.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough inventory for item {item_data.item_id}")

        issue_item = StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
        )
        db.add(issue_item)

        remaining_quantity = item_data.quantity
        stock_entries = db.query(StoreStockEntry)\
            .filter(StoreStockEntry.item_id == item_data.item_id, StoreStockEntry.quantity > 0)\
            .order_by(StoreStockEntry.purchase_date.asc())\
            .all()

        for stock_entry in stock_entries:
            if remaining_quantity <= 0:
                break

            if stock_entry.quantity >= remaining_quantity:
                stock_entry.quantity -= remaining_quantity
                remaining_quantity = 0
            else:
                remaining_quantity -= stock_entry.quantity
                stock_entry.quantity = 0

        if issue_data.issue_to.lower() == "bar":
            bar_inventory = db.query(BarInventory).filter_by(
                bar_id=issue_data.issued_to_id,
                item_id=item_data.item_id
            ).first()

            if bar_inventory:
                bar_inventory.quantity += item_data.quantity
            else:
                latest_stock = db.query(StoreStockEntry)\
                    .filter(StoreStockEntry.item_id == item_data.item_id)\
                    .order_by(StoreStockEntry.id.desc())\
                    .first()

                bar_inventory = BarInventory(
                    bar_id=issue_data.issued_to_id,
                    item_id=item_data.item_id,
                    quantity=item_data.quantity,
                    selling_price=latest_stock.unit_price if latest_stock else 0
                )
                db.add(bar_inventory)

    db.commit()
    db.refresh(issue)

    # ✅ Manually load issued_to info (Bar)
    if issue.issue_to.lower() == "bar":
        issued_to = db.query(Bar).filter(Bar.id == issue.issued_to_id).first()
        issue.issued_to = issued_to

    return issue




from typing import Optional, List
from fastapi import Query

@router.get("/issues", response_model=List[store_schemas.IssueDisplay])
def list_issues(  
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    bar_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    query = db.query(StoreIssue).options(joinedload(StoreIssue.issued_to))

    # Apply date filter
    if start_date:
        query = query.filter(StoreIssue.issue_date >= start_date)
    if end_date:
        query = query.filter(StoreIssue.issue_date <= end_date)

    # Apply bar name filter
    if bar_name:
        query = query.join(StoreIssue.issued_to).filter(Bar.name.ilike(f"%{bar_name}%"))

    # ✅ Order by ID DESC (newest on top)
    issues = query.order_by(StoreIssue.id.desc()).all()
    return issues if issues else []


@router.put("/issues/{issue_id}", response_model=store_schemas.IssueDisplay)
def update_issue(
    issue_id: int,
    update_data: store_schemas.IssueCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    issue = db.query(StoreIssue).filter_by(id=issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Step 1️⃣ Restore stock from old items before deleting them
    old_items = db.query(StoreIssueItem).filter_by(issue_id=issue_id).all()
    for old_item in old_items:
        # Restore stock quantities
        stock_entries = (
            db.query(StoreStockEntry)
            .filter(StoreStockEntry.item_id == old_item.item_id)
            .order_by(StoreStockEntry.purchase_date.asc())
            .all()
        )
        remaining_restore = old_item.quantity
        for entry in stock_entries:
            if remaining_restore <= 0:
                break
            entry.quantity += remaining_restore
            remaining_restore = 0

        # Restore bar inventory if applicable
        if issue.issue_to.lower() == "bar":
            bar_inventory = (
                db.query(BarInventory)
                .filter_by(bar_id=issue.issued_to_id, item_id=old_item.item_id)
                .first()
            )
            if bar_inventory:
                bar_inventory.quantity -= old_item.quantity
                if bar_inventory.quantity < 0:
                    bar_inventory.quantity = 0

    # Step 2️⃣ Delete old issue items
    db.query(StoreIssueItem).filter_by(issue_id=issue_id).delete()

    # Step 3️⃣ Update issue metadata
    issue.issue_to = update_data.issue_to
    issue.issued_to_id = update_data.issued_to_id
    issue.issue_date = update_data.issue_date or datetime.utcnow()
    issue.issued_by_id = current_user.id

    # Step 4️⃣ Add new issue items & deduct stock
    for item_data in update_data.issue_items:
        # Deduct from stock (FIFO)
        remaining_quantity = item_data.quantity
        stock_entries = (
            db.query(StoreStockEntry)
            .filter(StoreStockEntry.item_id == item_data.item_id, StoreStockEntry.quantity > 0)
            .order_by(StoreStockEntry.purchase_date.asc())
            .all()
        )
        for entry in stock_entries:
            if remaining_quantity <= 0:
                break
            if entry.quantity >= remaining_quantity:
                entry.quantity -= remaining_quantity
                remaining_quantity = 0
            else:
                remaining_quantity -= entry.quantity
                entry.quantity = 0

        # Update bar inventory if applicable
        if update_data.issue_to.lower() == "bar":
            bar_inventory = (
                db.query(BarInventory)
                .filter_by(bar_id=update_data.issued_to_id, item_id=item_data.item_id)
                .first()
            )
            if bar_inventory:
                bar_inventory.quantity += item_data.quantity
            else:
                latest_stock = (
                    db.query(StoreStockEntry)
                    .filter(StoreStockEntry.item_id == item_data.item_id)
                    .order_by(StoreStockEntry.id.desc())
                    .first()
                )
                bar_inventory = BarInventory(
                    bar_id=update_data.issued_to_id,
                    item_id=item_data.item_id,
                    quantity=item_data.quantity,
                    selling_price=latest_stock.unit_price if latest_stock else 0
                )
                db.add(bar_inventory)

        # Save the new issue item
        new_issue_item = StoreIssueItem(
            issue_id=issue_id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
        )
        db.add(new_issue_item)

    db.commit()
    db.refresh(issue)
    return issue

@router.delete("/issues/{issue_id}")
def delete_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    issue = db.query(StoreIssue).filter_by(id=issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Fetch all items in this issue
    issue_items = db.query(StoreIssueItem).filter_by(issue_id=issue.id).all()

    for item in issue_items:
        # 1️⃣ Restore StoreStockEntry quantities (FIFO reverse)
        # We reverse from the oldest entries to newest so stock is replenished correctly
        stock_entries = (
            db.query(StoreStockEntry)
            .filter(StoreStockEntry.item_id == item.item_id)
            .order_by(StoreStockEntry.purchase_date.asc())
            .all()
        )

        remaining_to_restore = item.quantity
        for stock_entry in stock_entries:
            # Restore until we've added back the full issued quantity
            if remaining_to_restore <= 0:
                break
            stock_entry.quantity += remaining_to_restore
            remaining_to_restore = 0

        # 2️⃣ If issue was to a bar, reduce bar inventory
        if issue.issue_to.lower() == "bar":
            bar_inventory = (
                db.query(BarInventory)
                .filter_by(bar_id=issue.issued_to_id, item_id=item.item_id)
                .first()
            )
            if bar_inventory:
                bar_inventory.quantity -= item.quantity
                if bar_inventory.quantity < 0:
                    bar_inventory.quantity = 0  # prevent negative

    # Delete the issue items and issue itself
    db.query(StoreIssueItem).filter_by(issue_id=issue.id).delete()
    db.delete(issue)

    db.commit()

    return {"detail": "✅ Issue deleted and stock restored successfully"}

# ----------------------------
# STORE BALANCE REPORT
# ----------------------------

from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from typing import Optional
from fastapi import Query

@router.get("/balance-stock", response_model=list[dict])
def get_store_balances(
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # 1) Historical Adjustments
    adjustments_q = (
        db.query(
            store_models.StoreInventoryAdjustment.item_id,
            func.coalesce(func.sum(store_models.StoreInventoryAdjustment.quantity_adjusted), 0).label("total_adjusted")
        )
        .group_by(store_models.StoreInventoryAdjustment.item_id)
        .all()
    )
    adjustment_map = {row.item_id: float(row.total_adjusted) for row in adjustments_q}

    # 2) Historical Issues
    issued_q = (
        db.query(
            store_models.StoreIssueItem.item_id,
            func.coalesce(func.sum(store_models.StoreIssueItem.quantity), 0).label("total_issued")
        )
        .group_by(store_models.StoreIssueItem.item_id)
        .all()
    )
    issued_map = {row.item_id: float(row.total_issued) for row in issued_q}

    # 3) Purchases & Current Stock
    query = (
        db.query(
            store_models.StoreItem.id.label("item_id"),
            store_models.StoreItem.name.label("item_name"),
            store_models.StoreItem.unit.label("unit"),
            store_models.StoreCategory.name.label("category_name"),
            func.coalesce(func.sum(store_models.StoreStockEntry.original_quantity), 0).label("total_received"),
            func.coalesce(func.sum(store_models.StoreStockEntry.quantity), 0).label("current_balance")
        )
        .join(store_models.StoreStockEntry, store_models.StoreItem.id == store_models.StoreStockEntry.item_id)
        .join(store_models.StoreCategory, store_models.StoreItem.category_id == store_models.StoreCategory.id)
    )

    if category_id:
        query = query.filter(store_models.StoreItem.category_id == category_id)

    query = query.group_by(store_models.StoreItem.id, store_models.StoreCategory.name)
    received_q = query.all()

    # 4) Build Final Response
    response = []
    for item in received_q:
        # Always pick the most recent stock entry for unit price
        latest_entry = (
            db.query(store_models.StoreStockEntry)
            .filter(store_models.StoreStockEntry.item_id == item.item_id)
            .order_by(store_models.StoreStockEntry.purchase_date.desc(), store_models.StoreStockEntry.id.desc())
            .first()
        )
        
        # Debug: Check the latest entry to verify it's correct
        print(f"Item ID: {item.item_id} Latest Entry: {latest_entry}")  # Debug print

        # Use the latest/current unit price
        current_unit_price = float(latest_entry.unit_price) if latest_entry else 0.0
        balance_value = current_unit_price * float(item.current_balance or 0)

        response.append({
            "item_id": item.item_id,
            "item_name": item.item_name,
            "category_name": item.category_name,
            "unit": item.unit,
            "total_received": float(item.total_received or 0),       # All-time purchases
            "total_issued": issued_map.get(item.item_id, 0),         # All-time issues
            "total_adjusted": adjustment_map.get(item.item_id, 0),   # All-time adjustments
            "balance": float(item.current_balance or 0),             # Actual current stock
            "current_unit_price": current_unit_price,                # ✅ Always the latest unit price
            "balance_total_amount": round(balance_value, 2),         # ✅ Cost at current unit price
        })

    return response




@router.post("/adjust", response_model=StoreInventoryAdjustmentDisplay)
def adjust_store_inventory(
    adjustment_data: StoreInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can adjust inventory.")

    # Get latest stock entry
    latest_entry = db.query(StoreStockEntry).filter(
        StoreStockEntry.item_id == adjustment_data.item_id,
        StoreStockEntry.quantity > 0
    ).order_by(StoreStockEntry.purchase_date.desc()).first()

    if not latest_entry:
        raise HTTPException(status_code=404, detail="Item not found or out of stock.")

    if adjustment_data.quantity_adjusted > latest_entry.quantity:
        raise HTTPException(status_code=400, detail="Adjustment exceeds available stock.")

    # Deduct quantity
    latest_entry.quantity -= adjustment_data.quantity_adjusted
    db.add(latest_entry)

    # Log adjustment
    adjustment = StoreInventoryAdjustment(
        item_id=adjustment_data.item_id,
        quantity_adjusted=adjustment_data.quantity_adjusted,
        reason=adjustment_data.reason,
        adjusted_by=current_user.username
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    return adjustment


@router.get("/adjustments", response_model=List[StoreInventoryAdjustmentDisplay])
def list_store_inventory_adjustments(
    item_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    query = db.query(StoreInventoryAdjustment)

    if item_id:
        query = query.filter(StoreInventoryAdjustment.item_id == item_id)
    if start_date:
        query = query.filter(StoreInventoryAdjustment.adjusted_at >= start_date)
    if end_date:
        query = query.filter(StoreInventoryAdjustment.adjusted_at <= end_date)

    return query.order_by(StoreInventoryAdjustment.adjusted_at.desc()).all()


@router.put("/adjustments/{adjustment_id}")
def update_adjustment(
    adjustment_id: int,
    data: StoreInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
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
        # -----------------------------
        # 1) Fetch issued items
        # -----------------------------
        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,
                store_models.StoreIssue.issued_to_id.label("bar_id"),
                func.sum(store_models.StoreIssueItem.quantity).label("total_received"),
            )
            .join(store_models.StoreIssue)
            .join(store_models.StoreItem)
        )

        if item_id:
            issued_query = issued_query.filter(store_models.StoreItem.id == item_id)
        if bar_id:
            issued_query = issued_query.filter(store_models.StoreIssue.issued_to_id == bar_id)

        issued_query = issued_query.group_by(
            store_models.StoreIssueItem.item_id,
            store_models.StoreIssue.issued_to_id,
        )
        issued_data = {
            (row.item_id, row.bar_id): {"total_received": float(row.total_received or 0)}
            for row in issued_query.all()
        }

        # -----------------------------
        # 2) Fetch sold items
        # -----------------------------
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
        sold_data = {(row.item_id, row.bar_id): float(row.total_sold or 0) for row in sold_query.all()}

        # -----------------------------
        # 3) Fetch adjusted items
        # -----------------------------
        adjusted_query = (
            db.query(
                bar_models.BarInventoryAdjustment.item_id,
                bar_models.BarInventoryAdjustment.bar_id,
                func.sum(bar_models.BarInventoryAdjustment.quantity_adjusted).label("total_adjusted"),
            )
            .join(store_models.StoreItem, bar_models.BarInventoryAdjustment.item_id == store_models.StoreItem.id)
        )

        if item_id:
            adjusted_query = adjusted_query.filter(store_models.StoreItem.id == item_id)
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

        # -----------------------------
        # 4) Merge all data
        # -----------------------------
        all_keys = set(issued_data.keys()) | set(sold_data.keys()) | set(adjusted_data.keys())
        results = []

        for (i_id, b_id) in all_keys:
            issued = issued_data.get((i_id, b_id), {"total_received": 0})["total_received"]
            sold = sold_data.get((i_id, b_id), 0)
            adjusted = adjusted_data.get((i_id, b_id), 0)
            balance = issued - sold - adjusted

            item = db.query(store_models.StoreItem).filter(store_models.StoreItem.id == i_id).first()
            if not item:
                continue

            bar = db.query(bar_models.Bar).get(b_id)

            # ---- Attempt 1: most recent entry WITH a non-null unit_price ----
            latest_entry = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.item_id == i_id,
                    store_models.StoreStockEntry.unit_price.isnot(None)
                )
                .order_by(store_models.StoreStockEntry.purchase_date.desc(), store_models.StoreStockEntry.id.desc())
                .first()
            )

            # ---- Attempt 2: if none found, fall back to the most recent entry (regardless of unit_price) ----
            if not latest_entry:
                latest_entry = (
                    db.query(store_models.StoreStockEntry)
                    .filter(store_models.StoreStockEntry.item_id == i_id)
                    .order_by(store_models.StoreStockEntry.purchase_date.desc(), store_models.StoreStockEntry.id.desc())
                    .first()
                )

            # ---- Attempt 3: final fallback - any entry with non-null price ordered by id descending ----
            if (not latest_entry) or (latest_entry and (latest_entry.unit_price is None)):
                fallback = (
                    db.query(store_models.StoreStockEntry)
                    .filter(
                        store_models.StoreStockEntry.item_id == i_id,
                        store_models.StoreStockEntry.unit_price.isnot(None)
                    )
                    .order_by(store_models.StoreStockEntry.id.desc())
                    .first()
                )
                if fallback:
                    latest_entry = fallback

            # parse price safely
            unit_price = None
            if latest_entry and latest_entry.unit_price is not None:
                try:
                    unit_price = float(latest_entry.unit_price)
                except Exception:
                    # if stored as Decimal/string, coerce via str then float
                    try:
                        unit_price = float(str(latest_entry.unit_price))
                    except Exception:
                        unit_price = None

            # Compute balance total only when we have a price
            balance_total_amount = round(balance * unit_price, 2) if unit_price is not None else None

            results.append(bar_schemas.BarStockBalance(
                bar_id=b_id,
                bar_name=bar.name if bar else "Unknown",
                item_id=i_id,
                item_name=item.name if item else "Unknown",
                category_name=item.category.name if item and item.category else "Uncategorized",
                unit=item.unit if item else "-",
                total_received=issued,
                total_sold=sold,
                total_adjusted=adjusted,
                balance=balance,
                last_unit_price=unit_price,               # note: this now holds the 'current' price if found
                balance_total_amount=balance_total_amount,
            ))

        # ✅ Sort results by item_name then bar_name
        results.sort(key=lambda x: (x.item_name.lower(), x.bar_name.lower()))

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stock balance: {str(e)}")
