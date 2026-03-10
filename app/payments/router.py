from fastapi import APIRouter, HTTPException, Depends, Query


from typing import Optional
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import between
from app.database import get_db
from app.payments import schemas as payment_schemas, crud
from app.payments import models as payment_models
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from app.users import schemas as user_schemas
from app.users import schemas
from app.rooms import models as room_models  # Ensure Room model is imported
from app.bookings import models as booking_models
from sqlalchemy.sql import func
from sqlalchemy import func
import pytz
from loguru import logger
from app.bookings import models  # Import the models module from bookings
from app.bank import models as  bank_models

import os


router = APIRouter()


# Set up logging
logger.add("app.log", rotation="500 MB", level="DEBUG")

from datetime import datetime
from zoneinfo import ZoneInfo

LAGOS_TZ = ZoneInfo("Africa/Lagos")

def get_local_time():
    return datetime.now(LAGOS_TZ)


def make_timezone_aware(dt: datetime) -> datetime:
    """
    Convert datetime to Lagos timezone-aware datetime.
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=LAGOS_TZ)

    return dt.astimezone(LAGOS_TZ)



# ---------------------------------------------------
# CREATE PAYMENT FOR BOOKING
# ---------------------------------------------------
@router.post("/{booking_id}")
def create_payment(
    booking_id: int,
    payment_request: payment_schemas.PaymentCreateSchema,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    business_id = current_user.business_id
    transaction_time = get_local_time()

    # -----------------------------
    # Normalize payment date
    # -----------------------------
    payment_date = make_timezone_aware(payment_request.payment_date)

    if payment_date > transaction_time:
        raise HTTPException(
            status_code=400,
            detail="Payment date cannot be in the future."
        )

    # -----------------------------
    # Fetch booking (Tenant Safe)
    # -----------------------------
    booking_record = db.query(booking_models.Booking).filter(
        booking_models.Booking.id == booking_id,
        booking_models.Booking.business_id == business_id
    ).first()

    if not booking_record:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking_date = make_timezone_aware(booking_record.booking_date)

    if payment_date.date() < booking_date.date():
        raise HTTPException(
            status_code=400,
            detail=f"Payment date cannot be earlier than booking date ({booking_date.date()})"
        )

    # -----------------------------
    # Fetch Room
    # -----------------------------
    room = crud.get_room_by_number(db, booking_record.room_number)

    if not room:
        raise HTTPException(
            status_code=404,
            detail=f"Room {booking_record.room_number} not found"
        )

    # -----------------------------
    # Validate booking status
    # -----------------------------
    allowed_status = ["checked-in", "reserved"]

    if booking_record.status not in allowed_status:
        if booking_record.status == "checked-out" and booking_record.payment_status != "fully paid":
            pass
        else:
            raise HTTPException(
                status_code=400,
                detail="Payment allowed only for checked-in, reserved, or checked-out bookings with balance."
            )

    # -----------------------------
    # Calculate totals
    # -----------------------------
    total_due = booking_record.number_of_days * room.amount

    existing_payments = db.query(payment_models.Payment).filter(
        payment_models.Payment.booking_id == booking_id,
        payment_models.Payment.status != "voided"
    ).all()

    total_existing_payment = sum(
        p.amount_paid + (p.discount_allowed or 0)
        for p in existing_payments
    )

    new_payment_total = (
        total_existing_payment
        + payment_request.amount_paid
        + (payment_request.discount_allowed or 0)
    )

    balance_due = total_due - new_payment_total

    # -----------------------------
    # Determine payment status
    # -----------------------------
    if balance_due > 0:
        payment_status = "part payment"
    elif balance_due < 0:
        payment_status = "excess payment"
    else:
        payment_status = "fully paid"

    # -----------------------------
    # Validate Bank (Tenant Safe)
    # -----------------------------
    bank_record = None
    method = payment_request.payment_method.lower()

    if method in ["bank_transfer", "pos_card"]:
        if not payment_request.bank_id:
            raise HTTPException(
                status_code=400,
                detail="Bank is required for POS or bank transfer."
            )

        bank_record = db.query(bank_models.Bank).filter(
            bank_models.Bank.id == payment_request.bank_id,
            bank_models.Bank.business_id == business_id
        ).first()

        if not bank_record:
            raise HTTPException(status_code=404, detail="Bank not found")

    else:
        payment_request.bank_id = None

    # -----------------------------
    # Create payment
    # -----------------------------
    new_payment = payment_models.Payment(
        booking_id=booking_id,
        business_id=business_id,
        amount_paid=payment_request.amount_paid,
        discount_allowed=payment_request.discount_allowed,
        payment_method=payment_request.payment_method,
        payment_date=payment_date,
        bank_id=payment_request.bank_id,
        balance_due=balance_due,
        status=payment_status,
        created_by=current_user.username
    )

    db.add(new_payment)

    # -----------------------------
    # Update booking payment status
    # -----------------------------
    booking_record.payment_status = payment_status

    db.commit()
    db.refresh(new_payment)

    return {
        "message": "Payment processed successfully",
        "payment_details": {
            "payment_id": new_payment.id,
            "amount_paid": new_payment.amount_paid,
            "discount_allowed": new_payment.discount_allowed,
            "payment_method": new_payment.payment_method,
            "bank": bank_record.name if bank_record else None,
            "payment_date": new_payment.payment_date,
            "balance_due": new_payment.balance_due,
            "status": new_payment.status,
            "created_by": new_payment.created_by
        }
    }





@router.get("/list")
def list_payments(
    start_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    business_id: Optional[int] = Query(None, description="Super admin can specify business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    """
    List payments including voided/cancelled for display,
    but exclude them from summary totals.

    Super Admin can pass business_id to inspect a specific business.
    """

    roles = set(current_user.roles)

    # -----------------------------
    # Determine target business
    # -----------------------------
    if "super_admin" in roles and business_id:
        target_business_id = business_id
    else:
        target_business_id = current_user.business_id

    # -----------------------------
    # Convert date filters
    # -----------------------------
    start_datetime = datetime.combine(start_date, datetime.min.time(), ZoneInfo("Africa/Lagos")) if start_date else None
    end_datetime = datetime.combine(end_date, datetime.max.time(), ZoneInfo("Africa/Lagos")) if end_date else None

    query = db.query(payment_models.Payment).filter(
        payment_models.Payment.business_id == target_business_id
    )

    if start_datetime and end_datetime:
        if start_datetime > end_datetime:
            raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
        query = query.filter(payment_models.Payment.payment_date.between(start_datetime, end_datetime))
    elif start_datetime:
        query = query.filter(payment_models.Payment.payment_date >= start_datetime)
    elif end_datetime:
        query = query.filter(payment_models.Payment.payment_date <= end_datetime)

    payments = query.order_by(payment_models.Payment.id.desc()).all()

    if not payments:
        return {"message": "No payments found for the specified criteria."}

    # -----------------------------
    # Fetch related bookings
    # -----------------------------
    booking_ids = {p.booking_id for p in payments if p.booking_id}

    bookings = {}
    if booking_ids:
        booking_objs = db.query(booking_models.Booking).filter(
            booking_models.Booking.id.in_(booking_ids),
            booking_models.Booking.business_id == target_business_id
        ).all()

        bookings = {b.id: b for b in booking_objs}

    # -----------------------------
    # Aggregate totals (non-voided)
    # -----------------------------
    sums_map = {}

    if booking_ids:
        agg = db.query(
            payment_models.Payment.booking_id,
            func.coalesce(func.sum(payment_models.Payment.amount_paid), 0).label("sum_paid"),
            func.coalesce(func.sum(payment_models.Payment.discount_allowed), 0).label("sum_discount")
        ).filter(
            payment_models.Payment.booking_id.in_(booking_ids),
            payment_models.Payment.business_id == target_business_id,
            ~payment_models.Payment.status.in_(["voided", "cancelled"])
        ).group_by(payment_models.Payment.booking_id).all()

        for row in agg:
            sums_map[row.booking_id] = {
                "sum_paid": float(row.sum_paid),
                "sum_discount": float(row.sum_discount),
            }

    # -----------------------------
    # Summary totals
    # -----------------------------
    total_bookings = set()
    total_booking_cost = 0
    total_amount_paid = 0
    total_discount_allowed = 0
    total_cash = 0
    total_pos = 0
    total_bank_transfer = 0

    bank_method_totals = {}

    method_map = {
        "pos": "pos_card",
        "card": "pos_card",
        "pos card": "pos_card",
        "pos_card": "pos_card",
        "transfer": "bank_transfer",
        "bank": "bank_transfer",
        "bank transfer": "bank_transfer",
        "bank_transfer": "bank_transfer",
        "cash": "cash",
    }

    payment_list = []

    # -----------------------------
    # Process payments
    # -----------------------------
    for payment in payments:

        booking = bookings.get(payment.booking_id)

        current_balance = None

        if booking:
            sums = sums_map.get(payment.booking_id, {"sum_paid": 0, "sum_discount": 0})
            current_balance = (booking.booking_cost or 0) - (
                sums["sum_paid"] + sums["sum_discount"]
            )

        payment_list.append({
            "payment_id": payment.id,
            "guest_name": payment.guest_name,
            "room_number": payment.room_number,
            "booking_cost": booking.booking_cost if booking else None,
            "amount_paid": payment.amount_paid,
            "discount_allowed": payment.discount_allowed,
            "balance_due": current_balance,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date.isoformat(),
            "status": payment.status,
            "void_date": payment.void_date.isoformat() if payment.void_date else None,
            "booking_id": payment.booking_id,
            "created_by": payment.created_by,
            "bank_id": payment.bank_id,
            "bank_name": payment.bank.name if payment.bank else None,
        })

        # Skip voided payments in totals
        if payment.status in ["voided", "cancelled"]:
            continue

        if booking and payment.booking_id not in total_bookings:
            total_booking_cost += booking.booking_cost or 0
            total_bookings.add(payment.booking_id)

        total_amount_paid += payment.amount_paid or 0
        total_discount_allowed += payment.discount_allowed or 0

        method = method_map.get(
            (payment.payment_method or "").lower(),
            (payment.payment_method or "").lower()
        )

        bank_name = payment.bank.name if payment.bank else None

        if method == "cash":
            total_cash += payment.amount_paid or 0

        elif method == "pos_card":
            total_pos += payment.amount_paid or 0

        elif method == "bank_transfer":
            total_bank_transfer += payment.amount_paid or 0

        if bank_name:
            if bank_name not in bank_method_totals:
                bank_method_totals[bank_name] = {"pos_card": 0, "bank_transfer": 0}

            if method == "pos_card":
                bank_method_totals[bank_name]["pos_card"] += payment.amount_paid or 0

            elif method == "bank_transfer":
                bank_method_totals[bank_name]["bank_transfer"] += payment.amount_paid or 0

    # -----------------------------
    # Compute total due
    # -----------------------------
    total_due = sum(
        (bookings[b].booking_cost or 0) -
        (
            sums_map.get(b, {"sum_paid": 0, "sum_discount": 0})["sum_paid"]
            + sums_map.get(b, {"sum_paid": 0, "sum_discount": 0})["sum_discount"]
        )
        for b in total_bookings
    )

    # -----------------------------
    # Final response
    # -----------------------------
    return {
        "summary": {
            "total_bookings": len(total_bookings),
            "total_booking_cost": total_booking_cost,
            "total_amount_paid": total_amount_paid,
            "total_discount_allowed": total_discount_allowed,
            "total_due": total_due,
        },
        "payment_method_totals": {
            "total_cash": total_cash,
            "total_pos": total_pos,
            "total_bank_transfer": total_bank_transfer,
            "total_payment": total_cash + total_pos + total_bank_transfer,
            **bank_method_totals
        },
        "payments": payment_list,
    }





@router.get("/by-bank")
def payments_by_bank(
    bank_name: Optional[str] = Query(None, description="Filter by bank name"),
    start_date: Optional[date] = Query(None, description="yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="yyyy-mm-dd"),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    """
    List payments filtered by bank, optionally within a date range,
    and provide a summary of POS and Bank Transfer totals.

    Voided/cancelled payments are included in the list but EXCLUDED from summary totals.
    """

    roles = set(current_user.roles)

    # --------------------------------
    # Determine target business
    # --------------------------------
    if "super_admin" in roles and business_id:
        target_business_id = business_id
    else:
        target_business_id = current_user.business_id

    # --------------------------------
    # Build query
    # --------------------------------
    query = db.query(payment_models.Payment).filter(
        payment_models.Payment.business_id == target_business_id
    )

    # --------------------------------
    # Date filters
    # --------------------------------
    if start_date:
        query = query.filter(
            payment_models.Payment.payment_date >= datetime.combine(
                start_date, datetime.min.time(), ZoneInfo("Africa/Lagos")
            )
        )

    if end_date:
        query = query.filter(
            payment_models.Payment.payment_date <= datetime.combine(
                end_date, datetime.max.time(), ZoneInfo("Africa/Lagos")
            )
        )

    # --------------------------------
    # Bank filter
    # --------------------------------
    if bank_name:
        query = query.join(bank_models.Bank).filter(
            bank_models.Bank.name.ilike(f"%{bank_name}%"),
            bank_models.Bank.business_id == target_business_id
        )

    payments = query.order_by(payment_models.Payment.id.desc()).all()

    if not payments:
        return {"message": "No payments found for the selected bank."}

    # --------------------------------
    # Fetch related bookings
    # --------------------------------
    booking_ids = {p.booking_id for p in payments if p.booking_id}

    bookings = {}

    if booking_ids:
        booking_objs = db.query(booking_models.Booking).filter(
            booking_models.Booking.id.in_(booking_ids),
            booking_models.Booking.business_id == target_business_id
        ).all()

        bookings = {b.id: b for b in booking_objs}

    # --------------------------------
    # Summary totals
    # --------------------------------
    total_pos = 0
    total_bank_transfer = 0

    method_map = {
        "pos": "pos_card",
        "card": "pos_card",
        "pos card": "pos_card",
        "pos_card": "pos_card",
        "transfer": "bank_transfer",
        "bank": "bank_transfer",
        "bank transfer": "bank_transfer",
        "bank_transfer": "bank_transfer",
        "cash": "cash",
    }

    payment_list = []

    # --------------------------------
    # Process payments
    # --------------------------------
    for payment in payments:

        booking = bookings.get(payment.booking_id)

        payment_list.append({
            "payment_id": payment.id,
            "guest_name": payment.guest_name,
            "room_number": payment.room_number,
            "booking_cost": booking.booking_cost if booking else None,
            "amount_paid": payment.amount_paid,
            "discount_allowed": payment.discount_allowed,
            "balance_due": (
                booking.booking_cost - (payment.amount_paid + (payment.discount_allowed or 0))
            ) if booking else None,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date.isoformat(),
            "status": payment.status,
            "void_date": payment.void_date.isoformat() if payment.void_date else None,
            "booking_id": payment.booking_id,
            "created_by": payment.created_by,
            "bank_id": payment.bank_id,
            "bank_name": payment.bank.name if payment.bank else None,
        })

        # Skip voided/cancelled for summary
        if payment.status in ["voided", "cancelled"]:
            continue

        method = method_map.get((payment.payment_method or "").lower(), "")

        if method == "pos_card":
            total_pos += payment.amount_paid or 0

        elif method == "bank_transfer":
            total_bank_transfer += payment.amount_paid or 0

    summary = {
        "total_pos": total_pos,
        "total_bank_transfer": total_bank_transfer,
    }

    return {
        "summary": summary,
        "payments": payment_list,
    }





@router.get("/by-status")
def list_payments_by_status(
    status: Optional[str] = Query(None, description="Payment status (fully paid, part payment, voided)"),
    start_date: Optional[date] = Query(None, description="Filter start date yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="Filter end date yyyy-mm-dd"),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    try:

        roles = set(current_user.roles)

        # -------------------------------------------------
        # Determine target business
        # -------------------------------------------------
        if "super_admin" in roles and business_id:
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        # -------------------------------------------------
        # Build base query
        # -------------------------------------------------
        query = (
            db.query(
                payment_models.Payment,
                booking_models.Booking.booking_cost,
                bank_models.Bank.name.label("bank_name")
            )
            .outerjoin(
                booking_models.Booking,
                payment_models.Payment.booking_id == booking_models.Booking.id
            )
            .outerjoin(
                bank_models.Bank,
                payment_models.Payment.bank_id == bank_models.Bank.id
            )
            .filter(payment_models.Payment.business_id == target_business_id)
        )

        # -------------------------------------------------
        # Status filter
        # -------------------------------------------------
        if status:
            query = query.filter(payment_models.Payment.status == status.lower())

        # -------------------------------------------------
        # Date filters
        # -------------------------------------------------
        if start_date:
            start_dt = datetime.combine(
                start_date, datetime.min.time(), ZoneInfo("Africa/Lagos")
            )
            query = query.filter(payment_models.Payment.payment_date >= start_dt)

        if end_date:
            end_dt = datetime.combine(
                end_date, datetime.max.time(), ZoneInfo("Africa/Lagos")
            )
            query = query.filter(payment_models.Payment.payment_date <= end_dt)

        results = query.order_by(payment_models.Payment.id.desc()).all()

        if not results:
            return {"message": "No payments found for the given criteria."}

        formatted_payments = []
        total_amount = 0

        # -------------------------------------------------
        # Normalize payment methods
        # -------------------------------------------------
        method_map = {
            "pos": "pos_card",
            "card": "pos_card",
            "pos card": "pos_card",
            "pos_card": "pos_card",
            "transfer": "bank_transfer",
            "bank": "bank_transfer",
            "bank transfer": "bank_transfer",
            "bank_transfer": "bank_transfer",
            "cash": "cash",
        }

        # -------------------------------------------------
        # Process results
        # -------------------------------------------------
        for payment, booking_cost, bank_name in results:

            total_amount += payment.amount_paid or 0

            payment_method = method_map.get(
                (payment.payment_method or "").lower(),
                payment.payment_method
            )

            formatted_payments.append({
                "payment_id": payment.id,
                "guest_name": payment.guest_name,
                "room_number": payment.room_number,
                "amount_paid": payment.amount_paid,
                "discount_allowed": payment.discount_allowed,
                "balance_due": payment.balance_due,
                "payment_method": payment_method,
                "bank": bank_name if bank_name else "N/A",
                "bank_id": payment.bank_id,
                "payment_date": payment.payment_date.isoformat(),
                "status": payment.status,
                "void_date": payment.void_date.isoformat() if payment.void_date else None,
                "booking_id": payment.booking_id,
                "created_by": payment.created_by,
                "booking_cost": booking_cost or 0
            })

        return {
            "message": "Payments retrieved successfully.",
            "total_payments": len(formatted_payments),
            "total_amount": total_amount,
            "payments": formatted_payments
        }

    except Exception as e:
        logger.error(f"Error retrieving payments by status/date: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )


@router.get("/total_daily_payment")
def total_payment(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    try:

        roles = set(current_user.roles)

        # --------------------------------------
        # Determine business
        # --------------------------------------
        if "super_admin" in roles and business_id:
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        # --------------------------------------
        # Lagos timezone today
        # --------------------------------------
        lagos_now = datetime.now(ZoneInfo("Africa/Lagos"))
        today_start = datetime.combine(lagos_now.date(), datetime.min.time(), ZoneInfo("Africa/Lagos"))
        today_end = today_start + timedelta(days=1)

        # --------------------------------------
        # Fetch payments
        # --------------------------------------
        payments = db.query(payment_models.Payment).filter(
            payment_models.Payment.business_id == target_business_id,
            payment_models.Payment.payment_date >= today_start,
            payment_models.Payment.payment_date < today_end,
            payment_models.Payment.status != "voided"
        ).order_by(payment_models.Payment.id.desc()).all()

        if not payments:
            return {
                "message": "No payments found for today.",
                "total_payments": 0,
                "total_amount": 0,
                "total_by_method": {},
                "payments": []
            }

        payment_list = []
        total_amount = 0

        # --------------------------------------
        # Payment method summary
        # --------------------------------------
        total_by_method = {
            "cash": 0,
            "pos_card": 0,
            "bank_transfer": 0
        }

        # --------------------------------------
        # Bank summary
        # --------------------------------------
        bank_summary = {}

        method_map = {
            "pos": "pos_card",
            "card": "pos_card",
            "pos card": "pos_card",
            "pos_card": "pos_card",
            "transfer": "bank_transfer",
            "bank": "bank_transfer",
            "bank transfer": "bank_transfer",
            "bank_transfer": "bank_transfer",
            "cash": "cash",
        }

        # --------------------------------------
        # Process payments
        # --------------------------------------
        for payment in payments:

            amount = payment.amount_paid or 0
            total_amount += amount

            method = method_map.get(
                (payment.payment_method or "").lower(),
                payment.payment_method
            )

            bank_name = payment.bank.name if payment.bank else None

            # Update main totals
            if method in total_by_method:
                total_by_method[method] += amount

            # --------------------------------
            # Bank summary
            # --------------------------------
            if bank_name:

                if bank_name not in bank_summary:
                    bank_summary[bank_name] = {
                        "pos_card": 0,
                        "bank_transfer": 0
                    }

                if method == "pos_card":
                    bank_summary[bank_name]["pos_card"] += amount

                if method == "bank_transfer":
                    bank_summary[bank_name]["bank_transfer"] += amount

            # --------------------------------
            # Payment list
            # --------------------------------
            payment_list.append({
                "payment_id": payment.id,
                "room_number": payment.room_number,
                "guest_name": payment.guest_name,
                "booking_cost": payment.booking.booking_cost if payment.booking else None,
                "amount_paid": payment.amount_paid,
                "discount_allowed": payment.discount_allowed,
                "balance_due": payment.balance_due,
                "payment_method": method,
                "payment_date": payment.payment_date.isoformat(),
                "status": payment.status,
                "booking_id": payment.booking_id,
                "created_by": payment.created_by,
                "bank": bank_name,
            })

        merged_summary = {
            **total_by_method,
            **bank_summary
        }

        return {
            "message": "Today's payment data retrieved successfully.",
            "total_payments": len(payment_list),
            "total_amount": total_amount,
            "total_by_method": merged_summary,
            "payments": payment_list,
        }

    except Exception as e:
        logger.error(f"Error retrieving daily sales: {repr(e)}")

        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving daily sales."
        )


from datetime import datetime, date

@router.get("/debtor_list")
def get_debtor_list(
    debtor_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    try:

        roles = set(current_user.roles)

        # --------------------------------------------
        # Determine business
        # --------------------------------------------
        if "super_admin" in roles and business_id:
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        # --------------------------------------------
        # Date parsing
        # --------------------------------------------
        def parse_date(d):
            return datetime.strptime(d, "%Y-%m-%d").date() if d else None

        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date)

        start_datetime = None
        end_datetime = None

        if start_date_obj:
            start_datetime = datetime.combine(
                start_date_obj,
                datetime.min.time(),
                ZoneInfo("Africa/Lagos")
            )

        if end_date_obj:
            end_datetime = datetime.combine(
                end_date_obj,
                datetime.max.time(),
                ZoneInfo("Africa/Lagos")
            )

        # --------------------------------------------
        # 1️⃣ GROSS DEBT (ALL BOOKINGS)
        # --------------------------------------------
        all_bookings = db.query(booking_models.Booking).filter(
            booking_models.Booking.business_id == target_business_id,
            booking_models.Booking.status != "cancelled",
            booking_models.Booking.payment_status != "complimentary"
        ).all()

        total_gross_debt = 0

        for booking in all_bookings:

            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number,
                room_models.Room.business_id == target_business_id
            ).first()

            if not room:
                continue

            total_due = (booking.number_of_days or 0) * (room.amount or 0)

            payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.business_id == target_business_id,
                payment_models.Payment.status != "voided"
            ).all()

            total_paid = sum(p.amount_paid or 0 for p in payments)
            total_discount = sum(p.discount_allowed or 0 for p in payments)

            balance_due = total_due - (total_paid + total_discount)

            if balance_due > 0:
                total_gross_debt += balance_due

        # --------------------------------------------
        # 2️⃣ CURRENT DEBT (FILTERED)
        # --------------------------------------------
        bookings_filtered = db.query(booking_models.Booking).filter(
            booking_models.Booking.business_id == target_business_id,
            booking_models.Booking.status != "cancelled",
            booking_models.Booking.payment_status != "complimentary"
        )

        if start_datetime:
            bookings_filtered = bookings_filtered.filter(
                booking_models.Booking.booking_date >= start_datetime
            )

        if end_datetime:
            bookings_filtered = bookings_filtered.filter(
                booking_models.Booking.booking_date <= end_datetime
            )

        if debtor_name:
            bookings_filtered = bookings_filtered.filter(
                booking_models.Booking.guest_name.ilike(f"%{debtor_name}%")
            )

        bookings_filtered = bookings_filtered.all()

        debtor_list = []
        total_current_debt = 0

        # --------------------------------------------
        # Process filtered bookings
        # --------------------------------------------
        for booking in bookings_filtered:

            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number,
                room_models.Room.business_id == target_business_id
            ).first()

            if not room:
                continue

            total_due = (booking.number_of_days or 0) * (room.amount or 0)

            payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.business_id == target_business_id,
                payment_models.Payment.status != "voided"
            ).all()

            total_paid = sum(p.amount_paid or 0 for p in payments)
            total_discount = sum(p.discount_allowed or 0 for p in payments)

            balance_due = total_due - (total_paid + total_discount)

            if balance_due > 0:

                last_payment_date = max(
                    (p.payment_date for p in payments if p.payment_date),
                    default=None
                )

                debtor_list.append({
                    "guest_name": booking.guest_name,
                    "room_number": booking.room_number,
                    "room_price": room.amount or 0,
                    "number_of_days": booking.number_of_days or 0,
                    "booking_id": booking.id,
                    "booking_cost": total_due,
                    "total_paid": total_paid,
                    "discount_allowed": total_discount,
                    "amount_due": balance_due,
                    "booking_date": booking.booking_date,
                    "last_payment_date": last_payment_date
                })

                total_current_debt += balance_due

        # --------------------------------------------
        # Sort by last payment
        # --------------------------------------------
        debtor_list.sort(
            key=lambda x: x["last_payment_date"] or datetime.min,
            reverse=True
        )

        return {
            "total_debtors": len(debtor_list),
            "total_current_debt": total_current_debt,
            "total_gross_debt": total_gross_debt,
            "debtors": debtor_list
        }

    except Exception as e:
        import traceback

        logger.error(
            f"Error retrieving debtor list: {repr(e)}\n{traceback.format_exc()}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/outstanding")
def list_outstanding_bookings(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    try:

        roles = set(current_user.roles)

        # --------------------------------------------
        # Determine target business
        # --------------------------------------------
        if "super_admin" in roles and business_id:
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        # --------------------------------------------
        # Fetch bookings
        # --------------------------------------------
        bookings = db.query(booking_models.Booking).filter(
            booking_models.Booking.business_id == target_business_id,
            booking_models.Booking.status != "cancelled",
            ~booking_models.Booking.payment_status.in_(["fully paid", "complimentary", "void"])
        ).all()

        outstanding = []

        for booking in bookings:

            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number,
                room_models.Room.business_id == target_business_id
            ).first()

            if not room:
                logger.warning(f"Room not found for booking {booking.id}")
                continue

            # --------------------------------------------
            # Calculate total due
            # --------------------------------------------
            total_due = booking.booking_cost or (
                (booking.number_of_days or 0) * (room.amount or 0)
            )

            payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.business_id == target_business_id,
                payment_models.Payment.status != "voided"
            ).all()

            total_paid = sum(p.amount_paid or 0 for p in payments)
            total_discount = sum(p.discount_allowed or 0 for p in payments)

            balance_due = total_due - (total_paid + total_discount)

            if balance_due > 0:

                outstanding.append({
                    "booking_id": booking.id,
                    "guest_name": booking.guest_name,
                    "room_number": booking.room_number,
                    "room_price": room.amount or 0,
                    "number_of_days": booking.number_of_days or 0,
                    "total_due": total_due,
                    "total_paid": total_paid,
                    "discount_allowed": total_discount,
                    "amount_due": balance_due,
                    "booking_date": booking.booking_date,
                    "payment_status": booking.payment_status,
                })

        # --------------------------------------------
        # No outstanding bookings
        # --------------------------------------------
        if not outstanding:
            return {
                "total_outstanding": 0,
                "total_outstanding_balance": 0,
                "outstanding_bookings": []
            }

        # --------------------------------------------
        # Sort newest first
        # --------------------------------------------
        outstanding.sort(
            key=lambda x: x["booking_date"] or datetime.min,
            reverse=True
        )

        total_outstanding_balance = sum(item["amount_due"] for item in outstanding)

        return {
            "total_outstanding": len(outstanding),
            "total_outstanding_balance": total_outstanding_balance,
            "outstanding_bookings": outstanding
        }

    except Exception as e:

        logger.error(f"Error in list_outstanding_bookings: {repr(e)}")

        raise HTTPException(
            status_code=500,
            detail="Could not fetch outstanding bookings."
        )


@router.get("/{payment_id}")
def get_payment_by_id(
    payment_id: int,
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard", "super_admin"]))
):
    """
    Get payment details by payment ID, including bank information.
    """

    try:

        roles = set(current_user.roles)

        # ---------------------------------------
        # Determine target business
        # ---------------------------------------
        if "super_admin" in roles and business_id:
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        logger.info(f"Fetching payment {payment_id} for business {target_business_id}")

        # ---------------------------------------
        # Fetch payment safely
        # ---------------------------------------
        payment = db.query(payment_models.Payment).filter(
            payment_models.Payment.id == payment_id,
            payment_models.Payment.business_id == target_business_id
        ).first()

        if not payment:
            logger.warning(f"Payment {payment_id} not found for business {target_business_id}")

            raise HTTPException(
                status_code=404,
                detail=f"Payment with ID {payment_id} not found."
            )

        # ---------------------------------------
        # Safe bank access
        # ---------------------------------------
        bank_name = payment.bank.name if payment.bank else "N/A"

        logger.info(f"Payment retrieved successfully: {payment_id}")

        return {
            "payment_id": payment.id,
            "guest_name": payment.guest_name,
            "room_number": payment.room_number,
            "amount_paid": payment.amount_paid,
            "discount_allowed": payment.discount_allowed,
            "balance_due": payment.balance_due,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
            "status": payment.status,
            "void_date": payment.void_date.isoformat() if payment.void_date else None,
            "booking_id": payment.booking_id,
            "created_by": payment.created_by,
            "bank": bank_name,
        }

    except HTTPException as e:

        logger.error(f"HTTPException occurred: {e.detail}")
        raise e

    except Exception as e:

        logger.error(f"Error fetching payment {payment_id}: {repr(e)}")

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving the payment."
        )


@router.put("/void/{payment_id}")
def void_payment(
    payment_id: int,
    business_id: Optional[int] = Query(None, description="Required for super admin"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin", "super_admin"]))
):
    try:

        roles = set(current_user.roles)

        # ---------------------------------------
        # Determine business (same logic as other endpoints)
        # ---------------------------------------
        if "super_admin" in roles:
            if not business_id:
                raise HTTPException(
                    status_code=400,
                    detail="business_id is required for super admin."
                )
            target_business_id = business_id
        else:
            target_business_id = current_user.business_id

        # ---------------------------------------
        # Fetch payment
        # ---------------------------------------
        payment = db.query(payment_models.Payment).filter(
            payment_models.Payment.id == payment_id,
            payment_models.Payment.business_id == target_business_id
        ).first()

        if not payment:
            logger.warning(f"Payment {payment_id} not found for business {target_business_id}")

            raise HTTPException(
                status_code=404,
                detail=f"Payment with ID {payment_id} not found."
            )

        # ---------------------------------------
        # Check if already voided
        # ---------------------------------------
        if payment.status == "voided":
            raise HTTPException(
                status_code=400,
                detail="Payment is already voided."
            )

        # ---------------------------------------
        # Void payment
        # ---------------------------------------
        lagos_now = datetime.now(ZoneInfo("Africa/Lagos"))

        payment.status = "voided"
        payment.void_date = lagos_now

        # ---------------------------------------
        # Update booking payment status
        # ---------------------------------------
        booking = db.query(booking_models.Booking).filter(
            booking_models.Booking.id == payment.booking_id,
            booking_models.Booking.business_id == target_business_id
        ).first()

        if booking:
            booking.payment_status = "pending"

        # ---------------------------------------
        # Save changes
        # ---------------------------------------
        db.commit()
        db.refresh(payment)

        logger.info(
            f"Payment {payment_id} voided successfully for business {target_business_id}"
        )

        bank_name = payment.bank.name if payment.bank else "N/A"

        return {
            "message": f"Payment {payment_id} has been voided successfully.",
            "payment_details": {
                "payment_id": payment.id,
                "status": payment.status,
                "void_date": payment.void_date.isoformat() if payment.void_date else None,
                "bank": bank_name,
            },
            "booking_details": {
                "booking_id": booking.id if booking else None,
                "payment_status": booking.payment_status if booking else "Not Found",
            },
        }

    except HTTPException as e:
        raise e

    except Exception as e:

        db.rollback()

        logger.error(f"Error voiding payment {payment_id}: {repr(e)}")

        raise HTTPException(
            status_code=500,
            detail="An error occurred while voiding the payment."
        )
