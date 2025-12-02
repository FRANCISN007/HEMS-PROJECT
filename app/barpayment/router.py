from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from sqlalchemy.sql import func
from datetime import date, timedelta
from typing import Optional, List
from sqlalchemy import func
from app.database import get_db
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from . import models, schemas
from app.bar.models import BarSale
from app.barpayment.models import  BarPayment
from app.barpayment import schemas as barpayment_schemas
from app.users import schemas as user_schemas
from app.bar import models as bar_models





router = APIRouter()

@router.post("/", response_model=schemas.BarPaymentDisplay)
def create_bar_payment(
    payment: schemas.BarPaymentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    sale = db.query(BarSale).filter(BarSale.id == payment.bar_sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Bar sale not found")

    db_payment = models.BarPayment(
        bar_sale_id=payment.bar_sale_id,
        amount_paid=payment.amount_paid,
        payment_method=payment.payment_method,
        bank=payment.bank,       # 👈 NEW
        note=payment.note,
        created_by=current_user.username,
        status="active"
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)

    total_paid = (
        db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
        .filter(models.BarPayment.bar_sale_id == payment.bar_sale_id)
        .filter(models.BarPayment.status == "active")
        .scalar()
    )

    balance_due = float(sale.total_amount) - float(total_paid)

    if total_paid == 0:
        status = "unpaid"
    elif total_paid < sale.total_amount:
        status = "part payment"
    else:
        status = "fully paid"

    return {
        "id": db_payment.id,
        "bar_sale_id": db_payment.bar_sale_id,
        "sale_amount": float(sale.total_amount),
        "amount_paid": float(db_payment.amount_paid),
        "balance_due": float(balance_due),
        "payment_method": db_payment.payment_method,
        "bank": db_payment.bank,         # 👈 NEW
        "note": db_payment.note,
        "date_paid": db_payment.date_paid,
        "created_by": db_payment.created_by,
        "status": status,
    }



@router.get("/")
def list_bar_payments(
    bar_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    query = db.query(models.BarPayment).order_by(models.BarPayment.date_paid.desc())

    # ✅ filter by bar
    if bar_id:
        query = query.join(BarSale).filter(BarSale.bar_id == bar_id)

    # ✅ if only start_date is provided, default end_date = today
    if start_date and not end_date:
        end_date = date.today()

    # ✅ filter by date range (inclusive)
    if start_date:
        query = query.filter(models.BarPayment.date_paid >= start_date)
    if end_date:
        query = query.filter(models.BarPayment.date_paid < end_date + timedelta(days=1))

    payments = query.all()
    response = []

    # Summary accumulators
    total_sales = 0
    total_paid_all = 0
    total_due_all = 0
    total_cash = 0
    total_pos = 0
    total_transfer = 0

    processed_sales = set()

    for p in payments:
        sale = db.query(BarSale).filter(BarSale.id == p.bar_sale_id).first()
        if not sale:
            continue

        # Total paid for this sale (active only)
        total_paid_for_sale = (
            db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
            .filter(
                models.BarPayment.bar_sale_id == sale.id,
                models.BarPayment.status == "active"
            )
            .scalar()
        )

        balance_due = float(sale.total_amount) - float(total_paid_for_sale)

        # add sale totals once
        if sale.id not in processed_sales:
            total_sales += float(sale.total_amount)
            total_due_all += balance_due
            processed_sales.add(sale.id)

        # count only active payments
        if p.status == "active":
            total_paid_all += float(p.amount_paid)

            method = p.payment_method.lower()
            if method == "cash":
                total_cash += float(p.amount_paid)
            elif method in ["pos", "card"]:
                total_pos += float(p.amount_paid)
            elif method == "transfer":
                total_transfer += float(p.amount_paid)

        # sale-level payment status
        if total_paid_for_sale == 0:
            sale_status = "unpaid"
        elif total_paid_for_sale < sale.total_amount:
            sale_status = "part payment"
        else:
            sale_status = "fully paid"

        row_status = "voided" if p.status == "voided" else sale_status

        response.append({
            "id": p.id,
            "bar_sale_id": p.bar_sale_id,
            "sale_amount": float(sale.total_amount),
            "amount_paid": float(p.amount_paid),
            "cumulative_paid": float(total_paid_for_sale),
            "balance_due": float(balance_due),
            "payment_method": p.payment_method,
            "bank": p.bank,              # 👈 NEW FIELD ADDED HERE
            "note": p.note,
            "date_paid": p.date_paid,
            "created_by": p.created_by,
            "status": row_status
        })

    return {
        "payments": response,
        "summary": {
            "total_sales": total_sales,
            "total_paid": total_paid_all,
            "total_due": total_due_all,
            "total_cash": total_cash,
            "total_pos": total_pos,
            "total_transfer": total_transfer,
        },
        "filters": {
            "bar_id": bar_id,
            "start_date": start_date,
            "end_date": end_date,
        }
    }


from fastapi import Query

@router.get("/outstanding", response_model=schemas.BarOutstandingSummary)
def list_outstanding_payments(
    bar_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    sales_query = db.query(BarSale)

    if bar_id:
        sales_query = sales_query.filter(BarSale.bar_id == bar_id)

    sales = sales_query.all()
    results = []
    total_due = 0.0

    for sale in sales:
        total_paid = (
            db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
            .filter(
                models.BarPayment.bar_sale_id == sale.id,
                models.BarPayment.status == "active"
            )
            .scalar()
        )

        balance_due = float(sale.total_amount) - float(total_paid)

        if balance_due > 0:
            if total_paid == 0:
                payment_status = "unpaid"
            elif total_paid < sale.total_amount:
                payment_status = "part payment"
            else:
                payment_status = "fully paid"

            results.append({
                "bar_sale_id": sale.id,
                "sale_amount": float(sale.total_amount),
                "amount_paid": float(total_paid),
                "balance_due": float(balance_due),
                "status": payment_status
            })

            total_due += balance_due

    return {
        "total_entries": len(results),
        "total_due": total_due,
        "results": results
    }




@router.put("/{payment_id}", response_model=schemas.BarPaymentDisplay)
def update_bar_payment(
    payment_id: int,
    update_data: schemas.BarPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    payment = (
        db.query(models.BarPayment)
        .filter(models.BarPayment.id == payment_id, models.BarPayment.status == "active")
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Active payment not found")

    # ✅ Apply updates
    if update_data.amount_paid is not None:
        payment.amount_paid = update_data.amount_paid
    if update_data.payment_method is not None:
        payment.payment_method = update_data.payment_method
    if update_data.bank is not None:           # 👈 NEW
        payment.bank = update_data.bank
    if update_data.note is not None:
        payment.note = update_data.note

    db.commit()
    db.refresh(payment)

    # ✅ Recalculate balance
    sale = db.query(BarSale).filter(BarSale.id == payment.bar_sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Bar sale not found")

    total_paid = (
        db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
        .filter(
            models.BarPayment.bar_sale_id == sale.id,
            models.BarPayment.status == "active"
        )
        .scalar()
    )

    balance_due = float(sale.total_amount) - float(total_paid)

    # ✅ Determine status
    if total_paid == 0:
        status = "unpaid"
    elif total_paid < sale.total_amount:
        status = "part payment"
    else:
        status = "fully paid"

    return {
        "id": payment.id,
        "bar_sale_id": payment.bar_sale_id,
        "sale_amount": float(sale.total_amount),
        "amount_paid": float(payment.amount_paid),
        "balance_due": float(balance_due),
        "payment_method": payment.payment_method,
        "bank": payment.bank,                # 👈 NEW FIELD RETURNED
        "note": payment.note,
        "date_paid": payment.date_paid,
        "created_by": payment.created_by,
        "status": status,
    }


@router.put("/{payment_id}/void", response_model=schemas.BarPaymentDisplay)
def void_bar_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    # ✅ Get payment
    payment = db.query(models.BarPayment).filter(
        models.BarPayment.id == payment_id,
        models.BarPayment.status == "active"
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Active payment not found")

    # ✅ Mark as voided
    payment.status = "voided"
    db.commit()
    db.refresh(payment)

    # ✅ Get related sale
    sale = db.query(BarSale).filter(BarSale.id == payment.bar_sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Related bar sale not found")

    # ✅ Recompute total paid for this sale (excluding voided)
    total_paid = (
        db.query(func.coalesce(func.sum(models.BarPayment.amount_paid), 0))
        .filter(
            models.BarPayment.bar_sale_id == sale.id,
            models.BarPayment.status == "active"   # exclude voided
        )
        .scalar()
    )

    balance_due = float(sale.total_amount) - float(total_paid)

    # ✅ Determine sale status
    if total_paid == 0:
        payment_status = "unpaid"
    elif total_paid < sale.total_amount:
        payment_status = "part payment"
    else:
        payment_status = "fully paid"

    return {
        "id": payment.id,
        "bar_sale_id": payment.bar_sale_id,
        "sale_amount": float(sale.total_amount),
        "amount_paid": float(payment.amount_paid),     # this specific payment (voided)
        "balance_due": float(balance_due),
        "payment_method": payment.payment_method,
        "bank": payment.bank,                          # 👈 NEW
        "note": payment.note,
        "date_paid": payment.date_paid,
        "created_by": payment.created_by,
        "status": "voided"                             # explicitly voided
    }



@router.get("/payment-status")
def get_bar_payment_status(
    bar_id: Optional[int] = Query(None, description="Filter by bar ID"),
    status: Optional[str] = Query(None, description="Filter by status: fully paid, part payment, pending, voided payment"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["bar"]))
):
    """
    Fetch bar payments with optional filters:
    - bar_id
    - status (fully paid, part payment, pending, voided payment)
    - start_date, end_date
    """

    # Query all payments and join with BarSale
    query = db.query(models.BarPayment).join(bar_models.BarSale)

    # Filter by bar_id if provided
    if bar_id:
        query = query.filter(bar_models.BarSale.bar_id == bar_id)

    # Filter by sale date
    if start_date:
        query = query.filter(bar_models.BarSale.sale_date >= start_date)
    if end_date:
        query = query.filter(bar_models.BarSale.sale_date <= end_date)

    payments = query.all()
    results = []

    for payment in payments:
        sale = payment.bar_sale  # Related BarSale
        amount_due = sale.total_amount if sale else 0

        # Total of all non-voided payments for this sale
        active_payments = [p.amount_paid for p in sale.payments if p.status == "active"] if sale else []
        total_paid = sum(active_payments)

        # Determine payment status
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

        # Apply status filter if provided
        if status and payment_status.lower() != status.lower():
            continue

        results.append({
            "payment_id": payment.id,
            "bar_sale_id": sale.id if sale else None,
            "amount_due": amount_due,
            "amount_paid": payment.amount_paid,
            "payment_status": payment_status,
            "date_paid": payment.date_paid,
            "payment_method": payment.payment_method,
            "created_by": payment.created_by,
        })

    return results





@router.delete("/{payment_id}", response_model=dict)
def delete_bar_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    ## ✅ Allow only admins
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can delete payments")

    payment = db.query(models.BarPayment).filter(models.BarPayment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()

    #return {"message": "Payment deleted successfully"}

    return {"detail": f"Payment with ID {payment_id} has been deleted"}

