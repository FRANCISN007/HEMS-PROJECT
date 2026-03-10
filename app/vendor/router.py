# app/vendors/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.vendor import models, schemas
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required

router = APIRouter()


# ---------------------------------------------------
# HELPER: Get Vendor Scoped To Business
# ---------------------------------------------------
def get_business_vendor(db: Session, vendor_id: int, business_id: int):
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id,
        models.Vendor.business_id == business_id
    ).first()

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    return vendor


# ---------------------------------------------------
# CREATE VENDOR
# ---------------------------------------------------
@router.post("/", response_model=schemas.VendorOut)
def create_vendor(
    vendor: schemas.VendorCreate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["admin"]))
):
    business_id = current_user.business_id

    normalized_name = vendor.business_name.strip().lower()

    existing_vendor = db.query(models.Vendor).filter(
        models.Vendor.business_id == business_id,
        func.lower(models.Vendor.business_name) == normalized_name
    ).first()

    if existing_vendor:
        raise HTTPException(
            status_code=400,
            detail="Vendor name already exists for this business"
        )

    new_vendor = models.Vendor(
        business_name=vendor.business_name.strip(),
        address=vendor.address.strip(),
        phone_number=vendor.phone_number.strip(),
        business_id=business_id
    )

    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    return new_vendor



# ---------------------------------------------------
# SIMPLE LIST (FOR DROPDOWNS)
# ---------------------------------------------------
@router.get("/simple")
def list_vendors_simple(
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["dashboard", "admin"]))
):
    vendors = db.query(
        models.Vendor.id,
        models.Vendor.business_name
    ).filter(
        models.Vendor.business_id == current_user.business_id
    ).order_by(models.Vendor.business_name).all()

    return [{"id": v.id, "name": v.business_name} for v in vendors]



# ---------------------------------------------------
# LIST VENDORS
# ---------------------------------------------------
@router.get("/", response_model=List[schemas.VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["dashboard", "admin"]))
):
    return db.query(models.Vendor).filter(
        models.Vendor.business_id == current_user.business_id
    ).order_by(models.Vendor.business_name).all()


# ---------------------------------------------------
# GET SINGLE VENDOR
# ---------------------------------------------------
@router.get("/{vendor_id}", response_model=schemas.VendorOut)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["dashboard", "admin"]))
):
    return get_business_vendor(db, vendor_id, current_user.business_id)



# ---------------------------------------------------
# UPDATE VENDOR
# ---------------------------------------------------
@router.put("/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(
    vendor_id: int,
    updated_data: schemas.VendorCreate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["admin"]))
):
    business_id = current_user.business_id

    vendor = get_business_vendor(db, vendor_id, business_id)

    normalized_name = updated_data.business_name.strip().lower()

    duplicate = db.query(models.Vendor).filter(
        models.Vendor.business_id == business_id,
        func.lower(models.Vendor.business_name) == normalized_name,
        models.Vendor.id != vendor_id
    ).first()

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="Vendor name already exists for this business"
        )

    vendor.business_name = updated_data.business_name.strip()
    vendor.address = updated_data.address.strip()
    vendor.phone_number = updated_data.phone_number.strip()

    db.commit()
    db.refresh(vendor)

    return vendor


# ---------------------------------------------------
# DELETE VENDOR
# ---------------------------------------------------
@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["admin"]))
):
    vendor = get_business_vendor(db, vendor_id, current_user.business_id)

    # Prevent deleting vendor used in purchases
    if vendor.purchases:
        raise HTTPException(
            status_code=400,
            detail="Vendor cannot be deleted because it is linked to purchases"
        )

    db.delete(vendor)
    db.commit()

    return {"detail": "Vendor deleted successfully"}
