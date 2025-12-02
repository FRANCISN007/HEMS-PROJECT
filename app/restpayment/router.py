
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
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # Fetch the sale
    sale = db.query(RestaurantSale).filter_by(id=sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # Calculate current balance
    total_paid = sum(p.amount_paid for p in sale.payments if not p.is_void)
    balance = (sale.total_amount or 0) - total_paid

    if payment.amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds outstanding balance. Balance left: {balance}"
        )

    # Normalize bank value
    bank_value = str(payment.bank).strip() if payment.bank else None
    if bank_value and bank_value.upper() in ("0", "NONE", "NULL", "", "NO BANK"):
        bank_value = None

    # Create the payment
    new_payment = RestaurantSalePayment(
        sale_id=sale.id,
        amount_paid=payment.amount,
        payment_mode=payment.payment_mode,
        bank=bank_value,
        paid_by=payment.paid_by,
        is_void=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(new_payment)
    db.flush()  # ✅ ensure payment is visible before updating sale status

    # Update linked sale status
    update_sale_status(sale, db)

    db.commit()
    db.refresh(sale)

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

    # -------------------------
    # GROUP PAYMENTS BY SALES
    # -------------------------
    for p in payments:
        sale = p.sale
        if not sale:
            continue

        if sale.id not in sales_map:
            total_paid_for_sale = (
                db.query(func.coalesce(func.sum(RestaurantSalePayment.amount_paid), 0))
                .filter(
                    RestaurantSalePayment.sale_id == sale.id,
                    RestaurantSalePayment.is_void == False
                )
                .scalar()
            )

            balance = float(sale.total_amount or 0) - float(total_paid_for_sale)

            status = (
                "unpaid" if total_paid_for_sale == 0 else
                "partial" if total_paid_for_sale < sale.total_amount else
                "paid"
            )

            sales_map[sale.id] = {
                "id": sale.id,
                "guest_name": sale.guest_name,
                "total_amount": float(sale.total_amount or 0),
                "amount_paid": float(total_paid_for_sale),
                "balance": balance,
                "payments": [],
                "status": status,
            }

        # ADD BANK TO PAYMENT RESPONSE
        payment_dict = {
            "id": p.id,
            "sale_id": p.sale_id,
            "amount_paid": float(p.amount_paid or 0),
            "payment_mode": p.payment_mode,
            "bank": p.bank,
            "paid_by": p.paid_by,
            "is_void": p.is_void,
            "created_at": p.created_at,
            "balance": sales_map[sale.id]["balance"],
        }

        sales_map[sale.id]["payments"].append(payment_dict)

    # ---------------------------------------------------
    # BUILD SUMMARY (TOTALS + BANK CATEGORY BREAKDOWN)
    # ---------------------------------------------------
    summary = {
        "total_sales": 0,
        "total_paid": 0,
        "total_due": 0,
        "total_cash": 0,
        "total_pos": 0,
        "total_transfer": 0,
        "banks": {}
    }

    for sale_data in sales_map.values():
        summary["total_sales"] += sale_data["total_amount"]
        summary["total_paid"] += sale_data["amount_paid"]
        summary["total_due"] += sale_data["balance"]

        for p in sale_data["payments"]:
            if p["is_void"]:
                continue

            amount = p["amount_paid"]
            mode = p["payment_mode"]
            bank = (p["bank"] or "").upper().strip()

            # -----------------------------
            # COUNT PAYMENT MODE TOTALS
            # -----------------------------
            if mode == "CASH":
                summary["total_cash"] += amount
            elif mode == "POS":
                summary["total_pos"] += amount
            elif mode == "TRANSFER":
                summary["total_transfer"] += amount

            # -----------------------------
            # BANK-WISE CATEGORIZATION
            # -----------------------------
            if bank:
                if bank not in summary["banks"]:
                    summary["banks"][bank] = {"pos": 0, "transfer": 0}

                if mode == "POS":
                    summary["banks"][bank]["pos"] += amount
                elif mode == "TRANSFER":
                    summary["banks"][bank]["transfer"] += amount

    redisplay_sales = [s for s in sales_map.values() if s["balance"] > 0]

    return {
        "sales": list(sales_map.values()),
        "summary": summary,
        "redisplay_sales": redisplay_sales
    }




from typing import List

from sqlalchemy import func



@router.put("/sales/payments/{payment_id}", response_model=RestaurantSalePaymentDisplay)
def update_payment(
    payment_id: int,
    payload: UpdatePaymentSchema,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["restaurant"]))
):
    # Fetch the payment
    payment = db.query(RestaurantSalePayment).filter_by(id=payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Track whether we made any changes
    updated = False

    # Update fields if provided
    if payload.amount_paid is not None and payment.amount_paid != payload.amount_paid:
        payment.amount_paid = payload.amount_paid
        updated = True

    if payload.payment_mode is not None and payment.payment_mode != payload.payment_mode:
        payment.payment_mode = payload.payment_mode
        updated = True

    if payload.paid_by is not None and payment.paid_by != payload.paid_by:
        payment.paid_by = payload.paid_by
        updated = True

    if payload.bank is not None:
        bank_value = str(payload.bank).strip()
        if bank_value.upper() in ("0", "NONE", "NULL", "", "NO BANK"):
            bank_value = None
        if payment.bank != bank_value:
            payment.bank = bank_value
            updated = True

    if updated:
        payment.updated_at = datetime.utcnow()
        db.add(payment)
        db.flush()  # ✅ ensure changes are visible to any subsequent queries

        # Update linked sale status after flushing payment changes
        sale = db.query(RestaurantSale).filter_by(id=payment.sale_id).first()
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
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    
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
