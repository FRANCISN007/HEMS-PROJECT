
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from fastapi import Query
from datetime import date
from typing import Optional, List
from collections import defaultdict
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from app.users.models import User
from app.users import schemas as user_schemas

from app.database import get_db
from app.restpayment.models import  RestaurantSalePayment
from app.restaurant.models import RestaurantSale

from app.restpayment.schemas import RestaurantSaleDisplay, RestaurantSalePaymentDisplay, PaymentCreate

from app.restpayment.schemas import RestaurantSaleWithPaymentsDisplay, UpdatePaymentSchema
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
    sale_id: Optional[int] = None,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    query = db.query(RestaurantSalePayment).join(RestaurantSale)

    # ✅ Sale filter
    if sale_id:
        query = query.filter(RestaurantSale.id == sale_id)

    # ✅ Date filter logic on PAYMENT date
    if start_date:
        query = query.filter(
            RestaurantSalePayment.created_at >= datetime.combine(start_date, datetime.min.time())
        )
    if end_date:
        query = query.filter(
            RestaurantSalePayment.created_at <= datetime.combine(end_date, datetime.max.time())
        )

    # ✅ Location filter
    if location_id:
        query = query.filter(RestaurantSale.location_id == location_id)

    # ✅ Exclude voids here
    query = query.filter(RestaurantSalePayment.is_void == False)

    # ✅ Order by PAYMENT date (newest first)
    payments = query.order_by(RestaurantSalePayment.created_at.desc()).all()

    # --- Build grouped response ---
    payment_summary = defaultdict(float)
    total_amount = 0.0
    sales_map = {}

    for p in payments:
        sale = p.sale  # relationship back to RestaurantSale
        if sale.id not in sales_map:
            sale_model = RestaurantSaleWithPaymentsDisplay.from_orm(sale)
            sales_map[sale.id] = sale_model.dict()
            sales_map[sale.id]["payments"] = []

        # ✅ Add payment, including paid_by
        payment_dict = {
            **RestaurantSalePaymentDisplay.from_orm(p).dict(),
            "paid_by": p.paid_by,
        }
        sales_map[sale.id]["payments"].append(payment_dict)

        # ✅ Summaries
        payment_summary[p.payment_mode] += float(p.amount_paid or 0.0)
        total_amount += float(p.amount_paid or 0.0)

    summary = {k: float(v) for k, v in payment_summary.items()}
    summary["Total"] = float(total_amount)

    # return as list (ordered by latest payment date)
    sales_display = list(sales_map.values())

    return {"sales": sales_display, "summary": summary}



@router.get("/sales/{sale_id}/payments", response_model=List[RestaurantSalePaymentDisplay])
def get_payments_for_sale(sale_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    return sale.payments


@router.get("/sales/{sale_id}/details", response_model=RestaurantSaleWithPaymentsDisplay)
def get_sale_with_payments(sale_id: int, 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
    payload: UpdatePaymentSchema,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    payment = db.query(RestaurantSalePayment).filter(RestaurantSalePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payload.amount_paid is not None:
        payment.amount_paid = payload.amount_paid
    if payload.payment_mode is not None:
        payment.payment_mode = payload.payment_mode
    if payload.paid_by is not None:
        payment.paid_by = payload.paid_by

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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
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
