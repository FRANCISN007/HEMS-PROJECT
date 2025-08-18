# app/vendors/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.vendor import models, schemas

#from app.vendor import models as vendor_models
#from app.vendor import schemas as vendor_schemas

router = APIRouter()

from fastapi import HTTPException, status
from sqlalchemy import func  # for case-insensitive search

@router.post("/", response_model=schemas.VendorOut)
def create_vendor(vendor: schemas.VendorCreate, db: Session = Depends(get_db)):
    # Normalize the business name: trim and lowercase
    normalized_name = vendor.business_name.strip().lower()

    # Check if vendor with same name exists (case-insensitive)
    existing_vendor = (
        db.query(models.Vendor)
        .filter(func.lower(models.Vendor.business_name) == normalized_name)
        .first()
    )
    if existing_vendor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor name already exists"
        )

    # Save vendor with trimmed business name
    vendor_data = vendor.dict()
    vendor_data["business_name"] = vendor.business_name.strip()
    new_vendor = models.Vendor(**vendor_data)

    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    return new_vendor

@router.get("/", response_model=List[schemas.VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(models.Vendor).order_by(models.Vendor.id.asc()).all()

@router.get("/{vendor_id}", response_model=schemas.VendorOut)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.put("/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(vendor_id: int, updated_data: schemas.VendorCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for key, value in updated_data.dict().items():
        setattr(vendor, key, value)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(vendor)
    db.commit()
    return {"detail": "Vendor deleted successfully"}
