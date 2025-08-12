from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
from sqlalchemy import func
from app.database import get_db
from app.users.auth import get_current_user
from . import models, schemas
from app.bar.models import BarSale
from app.barpayment.models import  BarPayment
from app.barpayment import schemas as barpayment_schemas
from app.users import schemas as user_schemas





router = APIRouter()

@router.post("/", response_model=schemas.BarPaymentDisplay)
def create_bar_payment(
    payment: schemas.BarPaymentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user)
):
    sale = db.query(BarSale).filter(BarSale.id == payment.bar_sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Bar sale not found")

    db_payment = models.BarPayment(
        bar_sale_id=payment.bar_sale_id,
        amount_paid=payment.amount_paid,
        payment_method=payment.payment_method,
        note=payment.note,
        created_by=current_user.username,
        status="active"
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)

    # Only sum ACTIVE payments
    total_paid = (
        db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
        .filter(models.BarPayment.bar_sale_id == payment.bar_sale_id)
        .filter(models.BarPayment.status == "active")
        .scalar()
    )

    if total_paid == 0:
        status = "pending"
    elif total_paid < sale.total_amount:
        status = "part payment"
    else:
        status = "fully paid"

    return {
        "id": db_payment.id,
        "bar_sale_id": db_payment.bar_sale_id,
        "amount_paid": db_payment.amount_paid,
        "payment_method": db_payment.payment_method,
        "note": db_payment.note,
        "date_paid": db_payment.date_paid,
        "created_by": db_payment.created_by,
        "status": status,
    }



from sqlalchemy.sql import func

@router.get("/", response_model=list[schemas.BarPaymentDisplay])
def list_bar_payments(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user)
):
    payments = db.query(models.BarPayment).all()
    response = []

    for p in payments:
        # If payment has been voided, status should be "voided"
        if p.status == "voided":
            response.append({
                "id": p.id,
                "bar_sale_id": p.bar_sale_id,
                "amount_paid": p.amount_paid,
                "payment_method": p.payment_method,
                "note": p.note,
                "date_paid": p.date_paid,
                "created_by": p.created_by,
                "status": "voided"
            })
            continue

        # Only compute payment status for active (non-voided) payments
        sale = db.query(BarSale).filter(BarSale.id == p.bar_sale_id).first()
        if not sale:
            continue

        total_paid = (
            db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
            .filter(
                models.BarPayment.bar_sale_id == p.bar_sale_id,
                models.BarPayment.status != "voided"
            )
            .scalar()
        )

        if total_paid == 0:
            payment_status = "pending"
        elif total_paid < sale.total_amount:
            payment_status = "part payment"
        else:
            payment_status = "fully paid"

        response.append({
            "id": p.id,
            "bar_sale_id": p.bar_sale_id,
            "amount_paid": p.amount_paid,
            "payment_method": p.payment_method,
            "note": p.note,
            "date_paid": p.date_paid,
            "created_by": p.created_by,
            "status": payment_status
        })

    return response



@router.put("/{payment_id}", response_model=schemas.BarPaymentDisplay)
def update_bar_payment(payment_id: int, update_data: schemas.BarPaymentUpdate, db: Session = Depends(get_db)):
    payment = db.query(models.BarPayment).filter(models.BarPayment.id == payment_id, models.BarPayment.status == "active").first()
    if not payment:
        raise HTTPException(status_code=404, detail="Active payment not found")

    if update_data.amount is not None:
        payment.amount = update_data.amount
    if update_data.payment_method is not None:
        payment.payment_method = update_data.payment_method

    db.commit()
    db.refresh(payment)
    return payment


@router.put("/{payment_id}/void", response_model=schemas.BarPaymentDisplay)
def void_bar_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.BarPayment).filter(
        models.BarPayment.id == payment_id,
        models.BarPayment.status == "active"
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Active payment not found")

    # Mark as voided
    payment.status = "voided"
    db.commit()
    db.refresh(payment)

    # Get related sale
    sale = db.query(BarSale).filter(BarSale.id == payment.bar_sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Related bar sale not found")

    # Recompute total paid for this sale (excluding voided)
    total_paid = (
        db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
        .filter(models.BarPayment.bar_sale_id == sale.id, models.BarPayment.status == "active")
        .scalar()
    )

    # Determine payment status
    if total_paid == 0:
        status = "pending"
    elif total_paid < sale.total_amount:
        status = "part payment"
    elif total_paid >= sale.total_amount:
        status = "fully paid"
    else:
        status = "pending"  # fallback

    return {
        "id": payment.id,
        "bar_sale_id": payment.bar_sale_id,
        "amount_paid": payment.amount_paid,
        "payment_method": payment.payment_method,
        "note": payment.note,
        "date_paid": payment.date_paid,
        "created_by": payment.created_by,
        "status": "voided",  # explicitly show this payment's status as 'voided'
    }


@router.get("/payment-status")
def get_bar_payment_status(
    status: Optional[str] = Query(None, description="Filter by status: fully paid, part payment, pending, voided payment"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    # Fetch all payments (active or voided)
    query = db.query(BarPayment).join(BarSale)

    if start_date:
        query = query.filter(BarSale.sale_date >= start_date)
    if end_date:
        query = query.filter(BarSale.sale_date <= end_date)

    payments = query.all()
    results = []

    for payment in payments:
        sale = payment.bar_sale  # related BarSale
        amount_due = sale.total_amount if sale else 0

        # Get total of all non-voided payments for this sale
        active_payments = [p.amount_paid for p in sale.payments if p.status == "active"]
        total_paid = sum(active_payments)

        # Determine status
        if payment.status == "voided":
            payment_status = "voided payment"
        elif not active_payments or total_paid == 0:
            payment_status = "pending"
        elif total_paid < amount_due:
            payment_status = "part payment"
        elif total_paid >= amount_due:
            payment_status = "fully paid"
        else:
            payment_status = "unknown"

        if status and payment_status.lower() != status.lower():
            continue

        results.append({
            "payment_id": payment.id,
            "bar_sale_id": sale.id if sale else None,
            "amount_due": amount_due,
            "amount_paid": payment.amount_paid,
            #"total_paid_for_sale": total_paid,
            "payment_status": payment_status,
            "date_paid": payment.date_paid,
            "payment_method": payment.payment_method,
            "created_by": payment.created_by,
            #"status": payment.status,
        })

    return results






@router.delete("/{payment_id}", response_model=dict)
def delete_bar_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user)
):
    payment = db.query(models.BarPayment).filter(models.BarPayment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()

    return {"detail": f"Payment with ID {payment_id} has been deleted"}

