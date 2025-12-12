from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.users.permissions import role_required  # 👈 permission helper

from app.database import get_db
from app.kitchen.models import Kitchen, KitchenInventory, KitchenStock, KitchenMenu
from app.kitchen.schemas import KitchenCreate, KitchenDisplaySimple, KitchenMenuDisplay, KitchenMenuCreate, KitchenMenuUpdate
from app.store.models import StoreItem
from app.users.schemas import UserDisplaySchema
from app.kitchen import models as kitchen_models
from app.kitchen import schemas as kitchen_schemas



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
def delete_kitchen(kitchen_id: int, db: Session = Depends(get_db)):
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
    current_user=Depends(role_required(["store", "admin"]))
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
