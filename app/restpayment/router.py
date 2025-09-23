
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
    payment: PaymentCreate,  # 👈 accept JSON body
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # 🔎 Find sale
    sale = db.query(RestaurantSale).filter(RestaurantSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # 🔎 Calculate how much is already paid (ignoring voided)
    total_paid = sum(p.amount_paid for p in sale.payments if not p.is_void)
    balance = (sale.total_amount or 0) - total_paid

    # 🚫 Prevent overpayment
    if payment.amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds outstanding balance. Balance left: {balance}"
        )

    # 💾 Record new payment
    new_payment = RestaurantSalePayment(
        sale_id=sale.id,
        amount_paid=payment.amount,
        payment_mode=payment.payment_mode,
        paid_by=payment.paid_by,
        is_void=False,  # ✅ important
        created_at=datetime.utcnow()
    )
    db.add(new_payment)
    db.commit()   # ✅ persist changes
    db.refresh(sale)  # ✅ reload sale with updated payments

    # 🔄 Update status (e.g., mark as fully_paid/partial)
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

    # ✅ Apply filters
    if sale_id:
        query = query.filter(RestaurantSale.id == sale_id)
    if start_date:
        query = query.filter(
            RestaurantSalePayment.created_at >= datetime.combine(start_date, datetime.min.time())
        )
    if end_date:
        query = query.filter(
            RestaurantSalePayment.created_at <= datetime.combine(end_date, datetime.max.time())
        )
    if location_id:
        query = query.filter(RestaurantSale.location_id == location_id)

    payments = query.order_by(RestaurantSalePayment.created_at.desc()).all()

    sales_map = {}

    # Step 1: Organize payments under their sales
    for p in payments:
        sale = p.sale
        if not sale:
            continue

        if sale.id not in sales_map:
            sales_map[sale.id] = {
                "id": sale.id,
                "guest_name": sale.guest_name,
                "total_amount": float(sale.total_amount or 0),
                "amount_paid": 0.0,  # will be accumulated
                "balance": float(sale.total_amount or 0),
                "payments": [],
                "status": "unpaid",
            }

        # Only count valid payments toward amount_paid
        if not p.is_void:
            sales_map[sale.id]["amount_paid"] += float(p.amount_paid or 0)

        # Balance = total - non-voided payments
        sales_map[sale.id]["balance"] = (
            sales_map[sale.id]["total_amount"] - sales_map[sale.id]["amount_paid"]
        )

        # Update payment status
        if sales_map[sale.id]["balance"] == 0:
            sales_map[sale.id]["status"] = "paid"
        elif sales_map[sale.id]["amount_paid"] > 0:
            sales_map[sale.id]["status"] = "partial"
        else:
            sales_map[sale.id]["status"] = "unpaid"

        # Add payment dict, with same balance reflected in every row
        payment_dict = {
            "id": p.id,
            "sale_id": p.sale_id,
            "amount_paid": float(p.amount_paid or 0),
            "payment_mode": p.payment_mode,
            "paid_by": p.paid_by,
            "is_void": p.is_void,
            "created_at": p.created_at,
            "balance": sales_map[sale.id]["balance"],
        }
        sales_map[sale.id]["payments"].append(payment_dict)

    # Step 2: Build summary
    total_paid = 0.0
    total_outstanding = 0.0
    payment_summary = defaultdict(float)

    for sale_data in sales_map.values():
        total_paid += sale_data["amount_paid"]
        total_outstanding += sale_data["balance"]

        for p in sale_data["payments"]:
            if not p["is_void"]:
                payment_summary[p["payment_mode"]] += p["amount_paid"]

    summary = {k: float(v) for k, v in payment_summary.items()}
    summary["Total Paid"] = float(total_paid)
    summary["Total Outstanding"] = float(total_outstanding)

    # Step 3: Redisplay sales with balance > 0
    redisplay_sales = [s for s in sales_map.values() if s["balance"] > 0]

    return {
        "sales": list(sales_map.values()),
        "summary": summary,
        "redisplay_sales": redisplay_sales
    }

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
