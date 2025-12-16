from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.users.permissions import role_required  # 👈 permission helper

from app.database import get_db
from app.kitchen.models import Kitchen, KitchenInventory, KitchenStock, KitchenMenu, KitchenInventoryAdjustment
from app.kitchen.schemas import KitchenCreate, KitchenDisplaySimple, KitchenMenuDisplay, KitchenMenuCreate, KitchenMenuUpdate
from app.kitchen.schemas import KitchenInventoryAdjustmentCreate, KitchenInventoryAdjustmentDisplay
from app.store.models import StoreItem
from app.users.schemas import UserDisplaySchema

from app.kitchen import models as kitchen_models
from app.kitchen import schemas as kitchen_schemas
from app.store import models as store_models


from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from app.users import schemas as user_schemas





router = APIRouter()



# ----------------------------
# Create a new kitchen
# ----------------------------
@router.post("/", response_model=KitchenDisplaySimple)
def create_kitchen(
    data: KitchenCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new kitchen.
    Note: Initial stock is handled separately via Store → Kitchen.
    """
    # Ensure kitchen name is unique
    existing = db.query(kitchen_models.Kitchen).filter(
        kitchen_models.Kitchen.name == data.name
    ).first()
    if existing:
        raise HTTPException(400, detail=f"Kitchen '{data.name}' already exists.")

    # Create kitchen
    kitchen = kitchen_models.Kitchen(name=data.name)
    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    return kitchen


# ----------------------------
# List all kitchens (full info)
# ----------------------------
@router.get("/", response_model=List[KitchenDisplaySimple])
def list_kitchens_full(db: Session = Depends(get_db)):
    """
    List all kitchens with full information.
    """
    kitchens = db.query(kitchen_models.Kitchen).order_by(kitchen_models.Kitchen.id.asc()).all()
    return kitchens


# ----------------------------
# List kitchens for dropdowns (simple)
# ----------------------------
@router.get("/simple", response_model=List[KitchenDisplaySimple])
def list_kitchens_simple(db: Session = Depends(get_db)):
    """
    Return a simplified list of kitchens (id + name) for dropdowns.
    """
    kitchens = db.query(kitchen_models.Kitchen).order_by(kitchen_models.Kitchen.id.asc()).all()
    return kitchens


# ----------------------------
# Update kitchen name
# ----------------------------
@router.put("/{kitchen_id}", response_model=KitchenDisplaySimple)
def update_kitchen(
    kitchen_id: int,
    data: KitchenCreate,  # Only allow updating the name
    db: Session = Depends(get_db)
):
    """
    Update the name of an existing kitchen.
    """
    kitchen = db.query(kitchen_models.Kitchen).filter(
        kitchen_models.Kitchen.id == kitchen_id
    ).first()
    if not kitchen:
        raise HTTPException(404, detail=f"Kitchen with ID {kitchen_id} not found.")

    # Check if new name is already used by another kitchen
    existing = db.query(kitchen_models.Kitchen).filter(
        kitchen_models.Kitchen.name == data.name,
        kitchen_models.Kitchen.id != kitchen_id
    ).first()
    if existing:
        raise HTTPException(400, detail=f"Another kitchen with name '{data.name}' already exists.")

    kitchen.name = data.name
    db.commit()
    db.refresh(kitchen)
    return kitchen



@router.delete("/{kitchen_id}", response_model=dict)
def delete_kitchen(kitchen_id: int, db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))               
    ):
    
    """
    Delete a kitchen by ID.
    Block deletion if there is existing inventory or stock.
    """
    kitchen = db.query(Kitchen).filter(Kitchen.id == kitchen_id).first()
    if not kitchen:
        raise HTTPException(
            status_code=404,
            detail=f"Kitchen with ID {kitchen_id} not found."
        )

    # Check if kitchen has any inventory
    has_inventory = db.query(KitchenInventory).filter(KitchenInventory.kitchen_id == kitchen_id).first()
    has_stock = db.query(KitchenStock).filter(KitchenStock.kitchen_id == kitchen_id).first()

    if has_inventory or has_stock:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete kitchen '{kitchen.name}' because it has existing inventory or stock."
        )

    db.delete(kitchen)
    db.commit()
    return {"detail": f"Kitchen '{kitchen.name}' deleted successfully."}




# kitchen/router.py
@router.get("/inventory/simple", response_model=List[kitchen_schemas.KitchenInventorySimple])
def list_kitchen_inventory_simple(
    kitchen_id: int = Query(...),
    db: Session = Depends(get_db),
    #current_user: user_schemas.UserDisplaySchema = Depends(
        #role_required(["admin", "store"])
    #)
):
    inventory = (
        db.query(kitchen_models.KitchenInventory)
        .filter(kitchen_models.KitchenInventory.kitchen_id == kitchen_id)
        .all()
    )

    return [
        kitchen_schemas.KitchenInventorySimple(
            id=inv.item.id,
            name=inv.item.name,
            unit=inv.item.unit,
            quantity=inv.quantity
        )
        for inv in inventory
    ]


# -------------------------
# Create kitchen adjustment
# -------------------------

@router.post("/adjust", response_model=kitchen_schemas.KitchenInventoryAdjustmentDisplay)
def adjust_kitchen_inventory(
    adjustment_data: kitchen_schemas.KitchenInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    """
    Adjust stock in a kitchen:
    - Deduct from KitchenInventory.quantity
    - Log adjustment in KitchenInventoryAdjustment
    - Update KitchenStock.total_used for historical tracking
    """
    # 1️⃣ Get current inventory record
    inventory = db.query(kitchen_models.KitchenInventory).filter(
        kitchen_models.KitchenInventory.kitchen_id == adjustment_data.kitchen_id,
        kitchen_models.KitchenInventory.item_id == adjustment_data.item_id
    ).first()

    if not inventory:
        raise HTTPException(404, detail="Item not found in kitchen inventory.")

    if adjustment_data.quantity_adjusted > inventory.quantity:
        raise HTTPException(400, detail="Adjustment exceeds available inventory.")

    # 2️⃣ Deduct from inventory
    inventory.quantity -= adjustment_data.quantity_adjusted
    db.add(inventory)

    # 3️⃣ Log adjustment
    adjustment = kitchen_models.KitchenInventoryAdjustment(
        kitchen_id=adjustment_data.kitchen_id,
        item_id=adjustment_data.item_id,
        quantity_adjusted=adjustment_data.quantity_adjusted,
        reason=adjustment_data.reason,
        adjusted_by=current_user.username,
        adjusted_at=datetime.utcnow()
    )
    db.add(adjustment)

    # 4️⃣ Update historical KitchenStock
    stock = db.query(kitchen_models.KitchenStock).filter(
        kitchen_models.KitchenStock.kitchen_id == adjustment_data.kitchen_id,
        kitchen_models.KitchenStock.item_id == adjustment_data.item_id
    ).first()

    if not stock:
        # create record if it doesn't exist
        stock = kitchen_models.KitchenStock(
            kitchen_id=adjustment_data.kitchen_id,
            item_id=adjustment_data.item_id,
            total_issued=0,
            total_used=0
        )
    stock.total_used += adjustment_data.quantity_adjusted
    db.add(stock)

    db.commit()
    db.refresh(adjustment)

    # 5️⃣ Prepare item display
    item_display = kitchen_schemas.KitchenItemMinimalDisplay(
        id=inventory.item.id,
        name=inventory.item.name
    )

    return kitchen_schemas.KitchenInventoryAdjustmentDisplay(
        id=adjustment.id,
        kitchen_id=adjustment.kitchen_id,
        item=item_display,
        quantity_adjusted=adjustment.quantity_adjusted,
        reason=adjustment.reason,
        adjusted_by=adjustment.adjusted_by,
        adjusted_at=adjustment.adjusted_at
    )
# -------------------------
# List kitchen adjustments
# -------------------------
@router.get("/adjustments", response_model=List[kitchen_schemas.KitchenInventoryAdjustmentDisplay])
def list_kitchen_inventory_adjustments(
    kitchen_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    query = db.query(kitchen_models.KitchenInventoryAdjustment)

    if kitchen_id:
        query = query.filter(kitchen_models.KitchenInventoryAdjustment.kitchen_id == kitchen_id)
    if item_id:
        query = query.filter(kitchen_models.KitchenInventoryAdjustment.item_id == item_id)
    if start_date:
        query = query.filter(kitchen_models.KitchenInventoryAdjustment.adjusted_at >= start_date)
    if end_date:
        query = query.filter(kitchen_models.KitchenInventoryAdjustment.adjusted_at <= end_date)

    adjustments = query.order_by(kitchen_models.KitchenInventoryAdjustment.adjusted_at.desc()).all()
    results = []

    for adj in adjustments:
        item_obj = db.query(store_models.StoreItem).filter_by(id=adj.item_id).first()
        item_display = kitchen_schemas.KitchenItemMinimalDisplay(
            id=item_obj.id,
            name=item_obj.name
        )
        results.append(kitchen_schemas.KitchenInventoryAdjustmentDisplay(
            id=adj.id,
            kitchen_id=adj.kitchen_id,
            item=item_display,
            quantity_adjusted=adj.quantity_adjusted,
            reason=adj.reason,
            adjusted_by=adj.adjusted_by,
            adjusted_at=adj.adjusted_at
        ))

    return results




@router.put(
    "/adjustments/{adjustment_id}",
    response_model=kitchen_schemas.KitchenInventoryAdjustmentDisplay
)
def update_kitchen_adjustment(
    adjustment_id: int,
    data: kitchen_schemas.KitchenInventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # 1️⃣ Fetch existing adjustment
    adjustment = (
        db.query(kitchen_models.KitchenInventoryAdjustment)
        .filter(kitchen_models.KitchenInventoryAdjustment.id == adjustment_id)
        .first()
    )
    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found.")

    old_item_id = adjustment.item_id
    old_quantity = adjustment.quantity_adjusted
    kitchen_id = adjustment.kitchen_id

    # 2️⃣ Restore OLD inventory
    old_inventory = (
        db.query(kitchen_models.KitchenInventory)
        .filter(
            kitchen_models.KitchenInventory.kitchen_id == kitchen_id,
            kitchen_models.KitchenInventory.item_id == old_item_id,
        )
        .first()
    )
    if not old_inventory:
        raise HTTPException(status_code=404, detail="Old inventory record not found.")

    old_inventory.quantity += old_quantity
    db.add(old_inventory)

    # 3️⃣ Restore OLD KitchenStock
    old_stock = (
        db.query(kitchen_models.KitchenStock)
        .filter(
            kitchen_models.KitchenStock.kitchen_id == kitchen_id,
            kitchen_models.KitchenStock.item_id == old_item_id,
        )
        .first()
    )
    if not old_stock:
        old_stock = kitchen_models.KitchenStock(
            kitchen_id=kitchen_id,
            item_id=old_item_id,
            total_issued=0,
            total_used=0,
        )

    old_stock.total_used -= old_quantity
    db.add(old_stock)

    # 4️⃣ Fetch NEW inventory
    new_inventory = (
        db.query(kitchen_models.KitchenInventory)
        .filter(
            kitchen_models.KitchenInventory.kitchen_id == kitchen_id,
            kitchen_models.KitchenInventory.item_id == data.item_id,
        )
        .first()
    )
    if not new_inventory:
        raise HTTPException(
            status_code=404,
            detail="Selected item does not exist in this kitchen."
        )

    # 5️⃣ Validate NEW adjustment
    if data.quantity_adjusted > new_inventory.quantity:
        raise HTTPException(
            status_code=400,
            detail="Adjustment exceeds available inventory."
        )

    # 6️⃣ Apply NEW inventory deduction
    new_inventory.quantity -= data.quantity_adjusted
    db.add(new_inventory)

    # 7️⃣ Update NEW KitchenStock
    new_stock = (
        db.query(kitchen_models.KitchenStock)
        .filter(
            kitchen_models.KitchenStock.kitchen_id == kitchen_id,
            kitchen_models.KitchenStock.item_id == data.item_id,
        )
        .first()
    )
    if not new_stock:
        new_stock = kitchen_models.KitchenStock(
            kitchen_id=kitchen_id,
            item_id=data.item_id,
            total_issued=0,
            total_used=0,
        )

    new_stock.total_used += data.quantity_adjusted
    db.add(new_stock)

    # 8️⃣ Update adjustment record
    adjustment.item_id = data.item_id
    adjustment.quantity_adjusted = data.quantity_adjusted
    adjustment.reason = data.reason
    adjustment.adjusted_by = current_user.username
    adjustment.adjusted_at = datetime.utcnow()
    db.add(adjustment)

    # 9️⃣ Commit atomically
    db.commit()
    db.refresh(adjustment)

    # 🔟 Response
    item = new_inventory.item
    return kitchen_schemas.KitchenInventoryAdjustmentDisplay(
        id=adjustment.id,
        kitchen_id=kitchen_id,
        item=kitchen_schemas.KitchenItemMinimalDisplay(
            id=item.id,
            name=item.name,
        ),
        quantity_adjusted=adjustment.quantity_adjusted,
        reason=adjustment.reason,
        adjusted_by=adjustment.adjusted_by,
        adjusted_at=adjustment.adjusted_at,
    )


# -------------------------
# Delete kitchen adjustment
# -------------------------
@router.delete("/adjustments/{adjustment_id}")
def delete_kitchen_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    adjustment = db.query(kitchen_models.KitchenInventoryAdjustment).filter(
        kitchen_models.KitchenInventoryAdjustment.id == adjustment_id
    ).first()
    if not adjustment:
        raise HTTPException(404, detail="Adjustment not found.")

    stock = db.query(kitchen_models.KitchenStock).filter(
        kitchen_models.KitchenStock.kitchen_id == adjustment.kitchen_id,
        kitchen_models.KitchenStock.item_id == adjustment.item_id
    ).first()

    if not stock:
        raise HTTPException(404, detail="Stock entry not found.")

    # Restore stock
    stock.total_used -= adjustment.quantity_adjusted
    db.add(stock)
    db.delete(adjustment)
    db.commit()

    return {"message": "Adjustment deleted successfully.", "restored_quantity": adjustment.quantity_adjusted, "current_stock": stock.total_issued - stock.total_used}




























@router.post("/kitchen-menu", response_model=KitchenMenuDisplay)
def create_kitchen_menu(
    data: KitchenMenuCreate,
    db: Session = Depends(get_db),
    current_user=Depends(role_required(["store", "admin"]))
):
    existing = db.query(KitchenMenu).filter_by(item_id=data.item_id).first()
    if existing:
        raise HTTPException(400, "Price for this item already exists")

    record = KitchenMenu(
        item_id=data.item_id,
        selling_price=data.selling_price
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    item = db.query(StoreItem).filter_by(id=data.item_id).first()

    return KitchenMenuDisplay(
        id=record.id,
        item_id=record.item_id,
        item_name=item.name if item else None,
        selling_price=record.selling_price
    )


@router.get("/kitchen-menu/items", response_model=List[KitchenMenuDisplay])
def get_kitchen_menu_items(
    db: Session = Depends(get_db),
    current_user=Depends(role_required(["store", "restaurant","admin"]))
):
    records = db.query(KitchenMenu).all()

    result = []
    for r in records:
        item = db.query(StoreItem).filter_by(id=r.item_id).first()
        result.append(
            KitchenMenuDisplay(
                id=r.id,
                item_id=r.item_id,
                item_name=item.name if item else None,
                selling_price=r.selling_price
            )
        )
    return result


from fastapi import Path, Body



@router.put("/kitchen-menu/{item_id}", response_model=KitchenMenuDisplay)
def update_kitchen_menu(
    item_id: int = Path(..., description="The store item ID to update"),
    data: KitchenMenuUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(role_required(["restaurant", "admin"]))
):
    # 1️⃣ Fetch existing record
    record = db.query(KitchenMenu).filter_by(item_id=item_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Kitchen menu item not found")

    # 2️⃣ Update price
    record.selling_price = data.selling_price
    db.commit()
    db.refresh(record)

    # 3️⃣ Fetch the related store item for name
    item = db.query(StoreItem).filter_by(id=record.item_id).first()

    # 4️⃣ Return updated record
    return KitchenMenuDisplay(
        id=record.id,
        item_id=record.item_id,
        item_name=item.name if item else None,
        selling_price=record.selling_price
    )
