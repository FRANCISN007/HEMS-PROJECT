from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import get_db
from app.events import models as event_models
from app.eventpayment import models as eventpayment_models, schemas as eventpayment_schemas
from app.users import schemas as user_schemas
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from typing import List
from sqlalchemy import and_
from datetime import datetime, timedelta, date
from sqlalchemy.sql import  case
from sqlalchemy.orm import aliased
from typing import Optional 
from loguru import logger
import pytz
from datetime import datetime, timedelta, date, time
from app.events import models as event_models # or wherever Event is
from app.users.permissions import role_required  # 👈 permission helper







router = APIRouter()



@router.post("/", response_model=eventpayment_schemas.EventPaymentResponse)
def create_event_payment(
    payment_data: eventpayment_schemas.EventPaymentCreate,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    # Fetch the event
    event = db.query(event_models.Event).filter(event_models.Event.id == payment_data.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.payment_status.lower() == "cancelled":
        raise HTTPException(
            status_code=400,
            detail=f"Payment cannot be processed because Event ID {payment_data.event_id} is cancelled."
        )

    # Calculate totals for balance
    total_paid = db.query(func.coalesce(func.sum(eventpayment_models.EventPayment.amount_paid), 0)).filter(
        eventpayment_models.EventPayment.event_id == payment_data.event_id,
        eventpayment_models.EventPayment.payment_status != "voided"
    ).scalar()

    total_discount = db.query(func.coalesce(func.sum(eventpayment_models.EventPayment.discount_allowed), 0)).filter(
        eventpayment_models.EventPayment.event_id == payment_data.event_id,
        eventpayment_models.EventPayment.payment_status != "voided"
    ).scalar()

    new_total_paid = total_paid + payment_data.amount_paid
    new_total_discount = total_discount + payment_data.discount_allowed
    total_cost = event.event_amount + event.caution_fee
    balance_due = total_cost - (new_total_paid + new_total_discount)

    if balance_due > 0:
        payment_status = "incomplete"
    elif balance_due == 0:
        payment_status = "complete"
    else:
        payment_status = "excess"

    # Create EventPayment
    new_payment = eventpayment_models.EventPayment(
        event_id=payment_data.event_id,
        organiser=payment_data.organiser,
        event_amount=event.event_amount,
        amount_paid=payment_data.amount_paid,
        discount_allowed=payment_data.discount_allowed,
        balance_due=balance_due,
        payment_method=payment_data.payment_method,
        bank=payment_data.bank,  # 👈 Track bank by name
        payment_status=payment_status,
        created_by=current_user.username
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    return new_payment


@router.get("/outstanding")
def list_outstanding_events(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    # Fetch events that are not fully paid or cancelled
    events = db.query(event_models.Event).filter(
        event_models.Event.payment_status != "payment completed",
        event_models.Event.payment_status != "cancelled"
    ).all()

    outstanding = []

    for event in events:
        total_due = (event.event_amount or 0) + (event.caution_fee or 0)

        payments = db.query(eventpayment_models.EventPayment).filter(
            eventpayment_models.EventPayment.event_id == event.id,
            eventpayment_models.EventPayment.payment_status != "voided"
        ).all()

        total_paid = sum(p.amount_paid for p in payments)
        total_discount = sum(p.discount_allowed or 0 for p in payments)
        balance_due = total_due - (total_paid + total_discount)

        if balance_due > 0:
            outstanding.append({
                "event_id": event.id,
                "organizer": event.organizer,
                "title": event.title,
                "location": event.location,
                "start_date": event.start_datetime,
                "end_date": event.end_datetime,
                "total_due": total_due,
                "total_paid": total_paid,
                "discount_allowed": total_discount,
                "amount_due": balance_due,
                "payment_status": event.payment_status,
            })

    # If no outstanding events → return empty list instead of raising 404
    if not outstanding:
        return {
            "total_outstanding": 0,
            "total_outstanding_balance": 0,
            "outstanding_events": []
        }

    outstanding.sort(key=lambda x: x["start_date"], reverse=True)

    total_outstanding_balance = sum(item["amount_due"] for item in outstanding)

    return {
        "total_outstanding": len(outstanding),
        "total_outstanding_balance": total_outstanding_balance,
        "outstanding_events": outstanding
    }




@router.get("/")
def list_event_payments(
    start_date: str = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(None, description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    query = db.query(eventpayment_models.EventPayment)

    # Apply date filters if both provided
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            query = query.filter(
                and_(
                    eventpayment_models.EventPayment.payment_date >= start_dt,
                    eventpayment_models.EventPayment.payment_date <= end_dt,
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    payments = query.all()
    formatted_payments = []

    total_event_cost = 0
    total_paid_amount = 0
    total_due_amount = 0
    unique_events = set()

    # For bank summary (exclude cash)
    bank_summary: Dict[str, Dict[str, float]] = {}

    for payment in payments:
        event = db.query(event_models.Event).filter(event_models.Event.id == payment.event_id).first()
        if not event:
            continue

        # Calculate totals excluding voided payments
        total_valid_paid = (
            db.query(func.coalesce(func.sum(eventpayment_models.EventPayment.amount_paid), 0))
            .filter(
                eventpayment_models.EventPayment.event_id == event.id,
                eventpayment_models.EventPayment.payment_status != "voided"
            )
            .scalar()
        )

        total_valid_discount = (
            db.query(func.coalesce(func.sum(eventpayment_models.EventPayment.discount_allowed), 0))
            .filter(
                eventpayment_models.EventPayment.event_id == event.id,
                eventpayment_models.EventPayment.payment_status != "voided"
            )
            .scalar()
        )

        event_amount = float(event.event_amount or 0)
        caution_fee = float(event.caution_fee or 0)
        total_due = event_amount + caution_fee
        balance_due = total_due - (float(total_valid_paid) + float(total_valid_discount))

        # Determine individual payment status
        if payment.payment_status == "voided":
            status = "voided"
        else:
            if balance_due > 0:
                status = "incomplete"
            elif balance_due == 0:
                status = "complete"
            else:
                status = "excess"

        formatted_payments.append({
            "id": payment.id,
            "event_id": payment.event_id,
            "organiser": payment.organiser,
            "event_amount": event_amount,
            "caution_fee": caution_fee,
            "total_due": total_due,
            "amount_paid": float(payment.amount_paid or 0),
            "discount_allowed": float(payment.discount_allowed or 0),
            "balance_due": balance_due,
            "payment_method": payment.payment_method,
            "bank": payment.bank,
            "payment_status": status,
            "payment_date": payment.payment_date.isoformat(),
            "created_by": payment.created_by,
        })

        # Only include non-voided payments in totals
        if payment.payment_status != "voided":
            if payment.event_id not in unique_events:
                unique_events.add(payment.event_id)
                total_event_cost += total_due
                total_due_amount += balance_due

            total_paid_amount += float(payment.amount_paid or 0)

            # Build bank summary (exclude cash)
            if payment.bank:
                bank = payment.bank.upper()
                if bank not in bank_summary:
                    bank_summary[bank] = {"pos": 0.0, "transfer": 0.0}
                method = (payment.payment_method or "").lower()
                if method in ("pos", "pos card", "card"):
                    bank_summary[bank]["pos"] += float(payment.amount_paid or 0)
                elif method == "bank transfer":
                    bank_summary[bank]["transfer"] += float(payment.amount_paid or 0)

    # Overall payment method summary (all banks)
    summary_query = db.query(
        eventpayment_models.EventPayment.payment_method,
        func.sum(eventpayment_models.EventPayment.amount_paid)
    ).filter(eventpayment_models.EventPayment.payment_status != "voided")

    if start_date and end_date:
        summary_query = summary_query.filter(
            and_(
                eventpayment_models.EventPayment.payment_date >= start_dt,
                eventpayment_models.EventPayment.payment_date <= end_dt,
            )
        )

    summary_results = summary_query.group_by(eventpayment_models.EventPayment.payment_method).all()
    summary = {"total_cash": 0.0, "total_pos": 0.0, "total_transfer": 0.0}
    for method, total in summary_results:
        if method:
            m = method.lower()
            if m == "cash":
                summary["total_cash"] = float(total)
            elif m in ("pos", "pos card", "card"):
                summary["total_pos"] = float(total)
            elif m == "bank transfer":
                summary["total_transfer"] = float(total)

    summary["total_payment"] = round(
        summary["total_cash"] + summary["total_pos"] + summary["total_transfer"], 2
    )

    return {
        "payments": formatted_payments,
        "summary": {
            "total_event_cost": total_event_cost,
            "total_paid": total_paid_amount,
            "total_due": total_due_amount,
            "by_method": summary,
            "by_bank": bank_summary
        }
    }



@router.get("/eventpayment/{payment_id}", response_model=dict)
def get_event_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    # ✅ Fetch the payment
    payment = db.query(eventpayment_models.EventPayment).filter(
        eventpayment_models.EventPayment.id == payment_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # ✅ Fetch the related event
    event = db.query(event_models.Event).filter(
        event_models.Event.id == payment.event_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # ✅ Compute totals just like list_event_payments
    total_paid = (
        db.query(func.sum(eventpayment_models.EventPayment.amount_paid))
        .filter(
            eventpayment_models.EventPayment.event_id == payment.event_id,
            eventpayment_models.EventPayment.payment_status != "voided"
        )
        .scalar()
    ) or 0

    total_discount = (
        db.query(func.sum(eventpayment_models.EventPayment.discount_allowed))
        .filter(
            eventpayment_models.EventPayment.event_id == payment.event_id,
            eventpayment_models.EventPayment.payment_status != "voided"
        )
        .scalar()
    ) or 0

    event_amount = float(event.event_amount or 0)
    caution_fee = float(event.caution_fee or 0)
    total_due = event_amount + caution_fee

    balance_due = total_due - (float(total_paid) + float(total_discount))

    # ✅ Return consistent response
    return {
        "id": payment.id,
        "event_id": payment.event_id,
        "organiser": payment.organiser,
        "event_amount": event_amount,
        "caution_fee": caution_fee,
        "total_due": total_due,
        "amount_paid": float(payment.amount_paid or 0),
        "discount_allowed": float(payment.discount_allowed or 0),
        "balance_due": balance_due,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
        "created_by": payment.created_by,
    }



@router.get("/event_debtor_list")
def get_event_debtor_list(
    organiser_name: Optional[str] = Query(None, description="Filter by organiser name"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be later than end date.")

    start_datetime = make_timezone_aware(datetime.combine(start_date, datetime.min.time())) if start_date else None
    end_datetime = make_timezone_aware(datetime.combine(end_date, datetime.max.time())) if end_date else None

    query = db.query(event_models.Event).filter(event_models.Event.payment_status != "cancelled")

    if organiser_name:
        query = query.filter(event_models.Event.organizer.ilike(f"%{organiser_name}%"))
    if start_datetime:
        query = query.filter(event_models.Event.created_at >= start_datetime)
    if end_datetime:
        query = query.filter(event_models.Event.created_at <= end_datetime)

    events = query.all()

    debtor_list = []
    total_current_debt = 0
    total_database_debt = 0

    for event in events:
        payments = db.query(eventpayment_models.EventPayment).filter(
            eventpayment_models.EventPayment.event_id == event.id,
            eventpayment_models.EventPayment.payment_status != "voided"
        ).all()

        total_paid = sum(p.amount_paid + (p.discount_allowed or 0) for p in payments)
        total_due = event.event_amount
        balance_due = total_due - total_paid

        payment_statuses = [p.payment_status.lower() for p in payments if p.payment_status]
        if "complete" in payment_statuses:
            payment_status = "complete"
        elif "incomplete" in payment_statuses:
            payment_status = "incomplete"
        else:
            payment_status = "active"

        if balance_due > 0:
            last_payment_date = max((p.payment_date for p in payments), default=None)
            debtor_list.append({
                "event_id": event.id,
                "organiser": event.organizer,
                "title": event.title,
                "start_datetime": event.start_datetime,
                "end_datetime": event.end_datetime,
                "event_amount": event.event_amount,
                "caution_fee": event.caution_fee,
                "location": event.location,
                "phone_number": event.phone_number,
                "address": event.address,
                "payment_status": payment_status,
                "balance_due": balance_due,
                "total_paid": total_paid,
                "created_by": event.created_by,
                "created_at": make_timezone_aware(event.created_at),
                "last_payment_date": make_timezone_aware(last_payment_date) if last_payment_date else None,
            })
            total_current_debt += balance_due

    # Total gross debt from all *non-cancelled* events
    all_events = db.query(event_models.Event).filter(event_models.Event.payment_status != "cancelled").all()
    for event in all_events:
        payments = db.query(eventpayment_models.EventPayment).filter(
            eventpayment_models.EventPayment.event_id == event.id,
            eventpayment_models.EventPayment.payment_status != "voided"
        ).all()
        total_paid = sum(p.amount_paid + (p.discount_allowed or 0) for p in payments)
        total_database_debt += max(event.event_amount - total_paid, 0)

    if not debtor_list:
        raise HTTPException(status_code=404, detail="No debtors found for the given criteria.")

    lagos_tz = pytz.timezone("Africa/Lagos")
    debtor_list.sort(
        key=lambda x: x["last_payment_date"] if x["last_payment_date"] else datetime.min.replace(tzinfo=lagos_tz),
        reverse=True
    )

    return {
        "total_debtors": len(debtor_list),
        "total_current_debt": total_current_debt,
        "total_gross_debt": total_database_debt,
        "debtors": debtor_list,
    }




@router.get("/status", response_model=List[eventpayment_schemas.EventPaymentResponse])
def list_event_payments_by_status(
    status: Optional[str] = Query(None, description="Payment status to filter by (pending, complete, incomplete, voided)"),
    start_date: Optional[date] = Query(None, description="Filter by payment date (start) in format yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="Filter by payment date (end) in format yyyy-mm-dd"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    query = db.query(eventpayment_models.EventPayment)

    if status:
        valid_statuses = {"pending", "complete", "incomplete", "voided"}
        if status.lower() not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid_statuses}")
        query = query.filter(eventpayment_models.EventPayment.payment_status == status)

    if start_date:
        query = query.filter(eventpayment_models.EventPayment.payment_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(eventpayment_models.EventPayment.payment_date <= datetime.combine(end_date, datetime.max.time()))

    payments = query.all()
    
    if not payments:
        return []  #  Return an empty list if no records are found

    return payments  #  Return list as expected





@router.put("/void/{payment_id}/", response_model=dict)
def void_event_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    try:
        payment = db.query(eventpayment_models.EventPayment).filter(
            eventpayment_models.EventPayment.id == payment_id
        ).first()

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        if payment.payment_status == "voided":
            raise HTTPException(status_code=400, detail="Payment has already been voided")

        event = db.query(event_models.Event).filter(event_models.Event.id == payment.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Associated event not found")

        payment.payment_status = "voided"

        # Recompute event balance excluding voided payments
        total_valid_payments = db.query(
            func.coalesce(func.sum(eventpayment_models.EventPayment.amount_paid), 0)
        ).filter(
            eventpayment_models.EventPayment.event_id == event.id,
            eventpayment_models.EventPayment.payment_status != "voided"
        ).scalar() or 0

        total_valid_discount = db.query(
            func.coalesce(func.sum(eventpayment_models.EventPayment.discount_allowed), 0)
        ).filter(
            eventpayment_models.EventPayment.event_id == event.id,
            eventpayment_models.EventPayment.payment_status != "voided"
        ).scalar() or 0

        event_total_due = float(event.event_amount or 0) + float(event.caution_fee or 0)
        event.balance_due = event_total_due - (float(total_valid_payments) + float(total_valid_discount))
        event.payment_status = "pending" if event.balance_due > 0 else "complete"

        db.commit()

        return {
            "message": f"Event Payment {payment_id} voided. Event balance updated.",
            "payment_details": {
                "payment_id": payment.id,
                "status": payment.payment_status
            },
            "event_details": {
                "event_id": event.id,
                "balance_due": event.balance_due,
                "payment_status": event.payment_status
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error voiding payment: {str(e)}")





lagos_tz = pytz.timezone("Africa/Lagos")

def make_timezone_aware(dt):
    """Convert naive datetime to Lagos timezone or adjust existing timezone-aware datetime."""
    return lagos_tz.localize(dt) if dt.tzinfo is None else dt.astimezone(lagos_tz)




@router.get("/{payment_id}")
def get_event_payment_by_id(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    # Fetch the payment record
    payment = db.query(eventpayment_models.EventPayment).filter(
        eventpayment_models.EventPayment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Fetch related event details
    event = db.query(event_models.Event).filter(
        event_models.Event.id == payment.event_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Compute balance_due correctly, excluding voided payments
    total_paid = (
        db.query(func.sum(eventpayment_models.EventPayment.amount_paid))
        .filter(
            eventpayment_models.EventPayment.event_id == payment.event_id,
            eventpayment_models.EventPayment.payment_status != "voided"  # Exclude voided payments
        )
        .scalar()
    ) or 0

    total_discount = (
        db.query(func.sum(eventpayment_models.EventPayment.discount_allowed))
        .filter(eventpayment_models.EventPayment.event_id == payment.event_id)
        .scalar()
    ) or 0

    # Ensure event_amount is a float to avoid type issues
    event_amount = float(event.event_amount)

    balance_due = event_amount - (float(total_paid) + float(total_discount))

    # Construct response including required fields
    formatted_payment = {
        "id": payment.id,  # Add the missing 'id' field
        "event_id": payment.event_id,
        "organiser": payment.organiser,
        "event_amount": event_amount,
        "amount_paid": float(payment.amount_paid),
        "discount_allowed": float(payment.discount_allowed),
        "balance_due": balance_due,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "payment_date": payment.payment_date,  # Add the missing 'payment_date' field
        "created_by": payment.created_by,
    }

    return formatted_payment


