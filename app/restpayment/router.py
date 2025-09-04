
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from fastapi import Query
from datetime import date
from typing import Optional, List
from collections import defaultdict
from app.users.auth import get_current_user
from app.users.models import User
from app.users import schemas as user_schemas

from app.database import get_db
from app.restpayment.models import  RestaurantSalePayment
from app.restaurant.models import RestaurantSale

from app.restpayment.schemas import RestaurantSaleDisplay, RestaurantSalePaymentDisplay, PaymentCreate

from app.restpayment.schemas import RestaurantSaleWithPaymentsDisplay
from app.restpayment.services import update_sale_status
from fastapi import Path



router = APIRouter()

# app/restpayment/routes.py


@router.post("/sales/{sale_id}/payments", response_model=RestaurantSaleDisplay)
def add_payment_to_sale(
    sale_id: int,
    amount: float = Query(...),
    payment_mode: str = Query(...),
    paid_by: str = Query(...),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    new_payment = RestaurantSalePayment(
        sale_id=sale.id,
        amount_paid=amount,
        payment_mode=payment_mode,
        paid_by=paid_by,
        created_at=datetime.utcnow()
    )
    db.add(new_payment)
    db.flush()

    update_sale_status(sale, db)
    return sale


@router.get("/sales/payments", response_model=dict)
def list_payments_with_items(
    sale_id: int = None,
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    query = db.query(RestaurantSale)

    if sale_id:
        query = query.filter(RestaurantSale.id == sale_id)
    if start_date:
        query = query.filter(RestaurantSale.created_at >= start_date)
    if end_date:
        query = query.filter(RestaurantSale.created_at <= end_date)

    sales = query.all()

    # Summary logic
    payment_summary = defaultdict(float)
    total_amount = 0.0

    # Build response list using schema
    sales_display = []

    for sale in sales:
        for payment in sale.payments:
            if not payment.is_void:   # <-- exclude voided payments
                payment_summary[payment.payment_mode] += payment.amount_paid
                total_amount += payment.amount_paid


        # Convert each sale to schema for serialization
        sale_data = RestaurantSaleWithPaymentsDisplay.from_orm(sale)
        sales_display.append(sale_data)

    summary = dict(payment_summary)
    summary["Total"] = total_amount

    return {
        "sales": sales_display,
        "summary": summary
    }


@router.get("/sales/{sale_id}/payments", response_model=List[RestaurantSalePaymentDisplay])
def get_payments_for_sale(sale_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    return sale.payments


@router.get("/sales/{sale_id}/details", response_model=RestaurantSaleWithPaymentsDisplay)
def get_sale_with_payments(sale_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    return sale


from typing import List

from sqlalchemy import func



# ✅ Update a payment
@router.put("/sales/payments/{payment_id}", response_model=RestaurantSalePaymentDisplay)
def update_payment(
    payment_id: int,
    amount: Optional[float] = Query(None),
    payment_mode: Optional[str] = Query(None),
    paid_by: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    payment = db.query(RestaurantSalePayment).filter(RestaurantSalePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if amount is not None:
        payment.amount_paid = amount
    if payment_mode is not None:
        payment.payment_mode = payment_mode
    if paid_by is not None:
        payment.paid_by = paid_by

    payment.updated_at = datetime.utcnow()
    db.add(payment)

    sale = db.query(RestaurantSale).filter(RestaurantSale.id == payment.sale_id).first()
    if sale:
        update_sale_status(sale, db)

    db.commit()
    db.refresh(payment)

    return payment


# ✅ Void a payment
# ✅ Void a payment (cancel transaction but keep history)
@router.put("/sales/payments/{payment_id}/void", response_model=RestaurantSalePaymentDisplay)
def void_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    payment = db.query(RestaurantSalePayment).filter(RestaurantSalePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.is_void:
        raise HTTPException(status_code=400, detail="Payment is already voided")

    # ✅ Keep amount_paid unchanged for history, just flag as void
    payment.is_void = True
    payment.updated_at = datetime.utcnow()
    db.add(payment)

    # ✅ Recalculate sale status, ignoring voided payments
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == payment.sale_id).first()
    if sale:
        update_sale_status(sale, db)

    db.commit()
    db.refresh(payment)

    return payment


@router.delete("/sales/payments/{payment_id}", response_model=RestaurantSaleDisplay)
def delete_payment(
    payment_id: int = Path(..., description="The ID of the payment to delete"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete payments.")

    payment = db.query(RestaurantSalePayment).filter(RestaurantSalePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    sale = db.query(RestaurantSale).filter(RestaurantSale.id == payment.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Associated sale not found")

    # Delete payment
    db.delete(payment)
    db.flush()  # Flush to reflect changes before recalculating

    # Recalculate sale status and balance
    update_sale_status(sale, db)

    return sale
