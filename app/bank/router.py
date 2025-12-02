from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from . import models, schemas
from app.users.schemas import UserDisplaySchema
from app.users import schemas as user_schemas

from app.payments import models as payment_models  # to check payment usage
from app.users.permissions import role_required  # 👈 permission helper

router = APIRouter()

# ----------------------------------------
# CREATE BANK
# ----------------------------------------
@router.post("/", response_model=schemas.BankDisplay)
def create_bank(
    bank: schemas.BankCreate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["admin"]))
):
    existing = db.query(models.Bank).filter(models.Bank.name == bank.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bank already exists")

    new_bank = models.Bank(name=bank.name)
    db.add(new_bank)
    db.commit()
    db.refresh(new_bank)
    return new_bank

# ----------------------------------------
# LIST BANKS
# ----------------------------------------
@router.get("/", response_model=List[schemas.BankDisplay])
def list_banks(
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["dashboard", "admin"]))
):
    return db.query(models.Bank).all()

@router.get("/simple", response_model=List[dict])
def list_banks_simple(
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["dashboard", "admin"]))
):
    banks = db.query(models.Bank.id, models.Bank.name).all()
    return [{"id": b.id, "name": b.name} for b in banks]

# ----------------------------------------
# UPDATE BANK
# ----------------------------------------
@router.put("/{bank_id}", response_model=schemas.BankDisplay)
def update_bank(
    bank_id: int,
    bank: schemas.BankUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["admin"]))
):
    db_bank = db.query(models.Bank).filter(models.Bank.id == bank_id).first()
    if not db_bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    db_bank.name = bank.name
    db.commit()
    db.refresh(db_bank)
    return db_bank

# ----------------------------------------
# DELETE BANK (Protected)
# ----------------------------------------
@router.delete("/{bank_id}")
def delete_bank(
    bank_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))  # ✅ only admin
):
    db_bank = db.query(models.Bank).filter(models.Bank.id == bank_id).first()
    if not db_bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    # Strict ORM check
    usage_count = db.query(payment_models.Payment).filter(
        payment_models.Payment.bank_id == bank_id
    ).count()

    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete bank '{db_bank.name}'. It has been used in {usage_count} payment(s)."
        )

    # Delete
    try:
        db.delete(db_bank)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Bank cannot be deleted because it is linked to payments."
        )

    return {"detail": "Bank deleted successfully"}
