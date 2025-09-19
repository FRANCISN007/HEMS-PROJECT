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
import pytz
from loguru import logger
from app.bookings import models  # Import the models module from bookings
import os


router = APIRouter()


# Set up logging
logger.add("app.log", rotation="500 MB", level="DEBUG")

#log_path = os.path.join(os.getenv("LOCALAPPDATA", "C:\\Temp"), "app.log")
#logger.add(log_path, rotation="500 MB", level="DEBUG")




@router.post("/{booking_id}")
def create_payment(
    booking_id: int,
    payment_request: payment_schemas.PaymentCreateSchema,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Create a new payment for a booking, considering discounts and payment history.
    """
    #transaction_time = datetime.now(timezone.utc)
    lagos_tz = pytz.timezone("Africa/Lagos")
    transaction_time = datetime.now(lagos_tz)

    # Force payment_date to be actual current Lagos time
    payment_date = transaction_time

    # Validate that payment_date is timezone-aware
    if payment_request.payment_date.tzinfo is None:
        raise HTTPException(
            status_code=400,
            detail="The provided payment_date must include timezone information."
        )

    # Validate that the transaction time is not in the future
    if payment_request.payment_date > transaction_time:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction time {payment_request.payment_date} cannot be in the future."
        )
     # Convert payment date to Lagos time zone for proper comparison
    payment_date = payment_request.payment_date.astimezone(lagos_tz)
    
     # Only admin can backdate payments (past dates)
    if payment_date.date() < transaction_time.date() and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=400,
            detail="Only admin is allowed to enter a past date for payments."
        )


    # Fetch the booking record
    booking_record = db.query(booking_models.Booking).filter(
        booking_models.Booking.id == booking_id
    ).first()

    if not booking_record:
        raise HTTPException(
            status_code=404, detail=f"Booking with ID {booking_id} does not exist."

        )
    
    # Convert booking_date to Lagos timezone
    booking_date = booking_record.booking_date.astimezone(lagos_tz)

    # Prevent posting a payment date earlier than the booking date
    if payment_date.date() < booking_date.date():
        raise HTTPException(
            status_code=400,
            detail=f"Payment date cannot be earlier than the booking date ({booking_date.date()})."
        )

    # Fetch the room associated with the booking
    room = crud.get_room_by_number(db, booking_record.room_number)
    if not room:
        raise HTTPException(
            status_code=404, detail=f"Room {booking_record.room_number} does not exist."
        )
    
    # Allow payments for checked-in, reserved, or checked-out (if not fully paid)
    if booking_record.status not in ["checked-in", "reserved"]:
        if booking_record.status == "checked-out" and booking_record.payment_status != "fully paid":
            pass  # allow payment
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Booking ID {booking_id} must be checked-in, reserved, or checked-out with pending balance to make a payment.",
            )

    
    

    # Calculate total due based on number of days and room price
    total_due = booking_record.number_of_days * room.amount

    # Fetch previous valid payments for this booking
    existing_payments = db.query(payment_models.Payment).filter(
        payment_models.Payment.booking_id == booking_id,
        payment_models.Payment.status != "voided",
    ).all()

    # Compute total amount already paid
    total_existing_payment = sum(
        payment.amount_paid + (payment.discount_allowed or 0) for payment in existing_payments
    )

    # Calculate new total payment after the current transaction
    new_total_payment = total_existing_payment + payment_request.amount_paid + (payment_request.discount_allowed or 0)
    balance_due = total_due - new_total_payment

    # Determine payment status
    if balance_due > 0:
        status = "part payment"
    elif balance_due < 0:
        status = "excess payment"
    else:
        status = "fully paid"

    try:
        # Create the new payment record
        new_payment = crud.create_payment(
            db=db,
            payment=payment_schemas.PaymentCreateSchema(
                amount_paid=payment_request.amount_paid,
                discount_allowed=payment_request.discount_allowed,
                payment_method=payment_request.payment_method,
                payment_date=payment_date,  # ✅ always actual Lagos payment time
            
            ),
            booking_id=booking_id,
            balance_due=balance_due,
            status=status,
             created_by=current_user.username,
        )

        # Update booking payment status
        booking_record.payment_status = status
        db.commit()

        return {
            "message": "Payment processed successfully.",
            "payment_details": {
                "payment_id": new_payment.id,
                "amount_paid": new_payment.amount_paid,
                "discount_allowed": payment_request.discount_allowed,
                "payment_date": new_payment.payment_date,
                "balance_due": new_payment.balance_due,
                "void_date": new_payment.void_date.strftime("%Y-%m-%d %H:%M:%S") if new_payment.void_date else "N/A",
                "status": new_payment.status,
                "created_by": current_user.username,  # Track who processed the payment
            },
        }

    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error creating payment: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error creating payment: {str(e)}")

    


@router.get("/list")
def list_payments(
    start_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    List all payments made between the specified start and end date.
    Provides a summarized view of total bookings, total amount paid, total discount, and total due.
    Excludes voided and cancelled payments from the total calculation.
    """
    try:
        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())

        query = db.query(payment_models.Payment)

        if start_date and end_date:
            if start_date > end_date:
                raise HTTPException(
                    status_code=400,
                    detail="Start date cannot be after end date."
                )
            query = query.filter(
                payment_models.Payment.payment_date >= start_datetime,
                payment_models.Payment.payment_date <= end_datetime
            )
        elif start_date:
            query = query.filter(payment_models.Payment.payment_date >= start_datetime)
        elif end_date:
            query = query.filter(payment_models.Payment.payment_date <= end_datetime)

        payments = query.order_by(payment_models.Payment.id.desc()).all()


        if not payments:
            logger.info("No payments found for the specified criteria.")
            return {"message": "No payments found for the specified criteria."}

        total_bookings = set()
        total_booking_cost = 0  # Corrected total booking cost calculation
        total_amount_paid = 0
        total_discount_allowed = 0
        total_due = 0

        total_cash = 0
        total_pos_card = 0
        total_bank_transfer = 0

        payment_list = []
        for payment in payments:
            booking = db.query(booking_models.Booking).filter(
                booking_models.Booking.id == payment.booking_id
            ).first()
            
            if booking and payment.booking_id not in total_bookings:
                total_booking_cost += booking.booking_cost
                total_bookings.add(payment.booking_id)

            
            payment_list.append({
                "payment_id": payment.id,
                "guest_name": payment.guest_name,
                "room_number": payment.room_number,
                "booking_cost": booking.booking_cost if booking else None,
                "amount_paid": payment.amount_paid,
                "discount_allowed": payment.discount_allowed,
                "balance_due": payment.balance_due,
                "payment_method": payment.payment_method,
                "payment_date": payment.payment_date.isoformat(),
                "status": payment.status,
                "void_date": payment.void_date.strftime("%Y-%m-%d %H:%M:%S") if payment.void_date else "N/A",
                "booking_id": payment.booking_id,
                "created_by": payment.created_by,
            })

            if payment.status not in ["voided", "cancelled"]:
                total_amount_paid += payment.amount_paid
                total_discount_allowed += payment.discount_allowed
                
                if payment.payment_method.lower() == "cash":
                    total_cash += payment.amount_paid
                elif payment.payment_method.lower() == "pos_card":
                    total_pos_card += payment.amount_paid
                elif payment.payment_method.lower() == "bank_transfer":
                    total_bank_transfer += payment.amount_paid

        # Corrected calculation for total due
        total_due = total_booking_cost - (total_amount_paid + total_discount_allowed)

        logger.info(f"Retrieved {len(payment_list)} payments.")

        return {
            "summary": {
                "total_bookings": len(total_bookings),
                "total_booking_cost": total_booking_cost,
                "total_amount_paid": total_amount_paid,
                "total_discount_allowed": total_discount_allowed,
                "total_due": total_due
            },
            "payment_method_totals": {
                "cash": total_cash,
                "pos_card": total_pos_card,
                "bank_transfer": total_bank_transfer
            },
            "payments": payment_list,
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while retrieving payments: {str(e)}"
        )





@router.get("/by-status")
def list_payments_by_status(
    status: Optional[str] = Query(None, description="Payment status to filter by (fully paid, part payment, voided)"),
    start_date: Optional[date] = Query(None, description="Filter by payment date (start) in format yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="Filter by payment date (end) in format yyyy-mm-dd"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:
        # Build the base query and join with booking
        query = (
            db.query(payment_models.Payment, booking_models.Booking.booking_cost)
            .join(booking_models.Booking, payment_models.Payment.booking_id == booking_models.Booking.id, isouter=True)
        )

        # Filter by status
        if status:
            query = query.filter(payment_models.Payment.status == status.lower())

        # Filter by payment date
        if start_date:
            query = query.filter(payment_models.Payment.payment_date >= start_date)
        if end_date:
            query = query.filter(payment_models.Payment.payment_date < (end_date + timedelta(days=1)))

        results = query.all()

        if not results:
            return {"message": "No payments found for the given criteria."}

        formatted_payments = []
        total_amount = 0

        for payment, booking_cost in results:
            total_amount += payment.amount_paid or 0
            formatted_payments.append({
                "payment_id": payment.id,
                "guest_name": payment.guest_name,
                "room_number": payment.room_number,
                "amount_paid": payment.amount_paid,
                "discount_allowed": payment.discount_allowed,
                "balance_due": payment.balance_due,
                "payment_method": payment.payment_method,
                "payment_date": payment.payment_date.isoformat(),
                "status": payment.status,
                "void_date": payment.void_date,
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
        logger.error(f"Error retrieving payments by status and date: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}",
        )


@router.get("/total_daily_payment")
def total_payment(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Retrieve total daily sales with a breakdown of payment methods (POS Card, Bank Transfer, Cash),
    and a list of payments for the current day, excluding void payments. Also includes booking cost.
    """
    try:
        today = datetime.now().date()

        payments = db.query(payment_models.Payment).filter(
            payment_models.Payment.payment_date >= today,
            payment_models.Payment.payment_date < today + timedelta(days=1),
            payment_models.Payment.status != "voided"
        ).all()

        if not payments:
            return {
                "message": "No payments found for today.",
                "total_payments": 0,
                "total_amount": 0,
                "total_by_method": {
                    "pos_card": 0,
                    "bank_transfer": 0,
                    "cash": 0
                },
                "payments": []
            }

        payment_list = []
        total_amount = 0
        total_by_method = {
            "pos_card": 0,
            "bank_transfer": 0,
            "cash": 0
        }

        for payment in payments:
            total_amount += payment.amount_paid

            if payment.payment_method in total_by_method:
                total_by_method[payment.payment_method] += payment.amount_paid

            # Safely access booking_cost from related booking
            booking_cost = (
                payment.booking.booking_cost if hasattr(payment, "booking") and payment.booking else None
            )

            payment_list.append({
                "payment_id": payment.id,
                "room_number": payment.room_number,
                "guest_name": payment.guest_name,
                "booking_cost": booking_cost,  # ✅ Add booking_cost here
                "amount_paid": payment.amount_paid,
                "discount_allowed": payment.discount_allowed,
                "balance_due": payment.balance_due,
                "payment_method": payment.payment_method,
                "payment_date": payment.payment_date.isoformat(),
                "status": payment.status,
                "booking_id": payment.booking_id,
                "created_by": payment.created_by,
                
            })

        return {
            "message": "Today's payment data retrieved successfully.",
            "total_payments": len(payment_list),
            "total_amount": total_amount,
            "total_by_method": total_by_method,
            "payments": payment_list,
        }

    except Exception as e:
        logger.error(f"Error retrieving daily sales: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving daily sales."
        )


lagos_tz = pytz.timezone("Africa/Lagos")

def make_timezone_aware(dt):
    """Convert naive datetime to Lagos timezone or adjust existing timezone-aware datetime."""
    return lagos_tz.localize(dt) if dt.tzinfo is None else dt.astimezone(lagos_tz)

@router.get("/debtor_list")
def get_debtor_list(
    debtor_name: Optional[str] = Query(None, description="Filter by debtor name (guest name)"),
    start_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:
        # Ensure that the start_date is not greater than end_date
        if start_date and end_date and start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date cannot be later than end date, check your date entry"
            )

        # Convert start and end dates to timezone-aware timestamps in Lagos time
        start_datetime = make_timezone_aware(datetime.combine(start_date, datetime.min.time())) if start_date else None
        end_datetime = make_timezone_aware(datetime.combine(end_date, datetime.max.time())) if end_date else None

        # Query all bookings that are not canceled and not complimentary
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.status != "cancelled",
            booking_models.Booking.payment_status != "complimentary"
        )

        if start_datetime:
            query = query.filter(booking_models.Booking.booking_date >= start_datetime)
        if end_datetime:
            query = query.filter(booking_models.Booking.booking_date <= end_datetime)
        if debtor_name:
            query = query.filter(booking_models.Booking.guest_name.ilike(f"%{debtor_name}%"))  # Case-insensitive search

        bookings = query.all()

        if not bookings:
            raise HTTPException(status_code=404, detail="No debtor bookings found for the given criteria.")

        debtor_list = []
        total_debt_amount = 0  # Current total debt in date range
        total_database_debt = 0  # Total debt in the database

        # Iterate through each booking
        for booking in bookings:
            # Fetch the room associated with the booking
            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number
            ).first()

            if not room:
                continue

            # Calculate total amount due
            total_due = booking.number_of_days * room.amount

            # Query all payments for this booking, ignoring voided payments
            all_payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.status != "voided"
            ).all()

            # Calculate total paid and discount
            total_paid = sum(payment.amount_paid for payment in all_payments)
            total_discount = sum(payment.discount_allowed or 0 for payment in all_payments)

            # Get last payment date if exists
            last_payment_date = (
                make_timezone_aware(max(payment.payment_date for payment in all_payments))
                if all_payments else None
            )

            # Calculate balance due
            balance_due = total_due - (total_paid + total_discount)

            # Include only if balance_due > 0
            if balance_due > 0:
                debtor_list.append({
                    "guest_name": booking.guest_name,
                    "room_number": booking.room_number,
                    "booking_id": booking.id,
                    "room_price": room.amount,
                    "number_of_days": booking.number_of_days,
                    "booking_cost": total_due,
                    "total_paid": total_paid,
                    "discount_allowed": total_discount,
                    "amount_due": balance_due,
                    "booking_date": make_timezone_aware(booking.booking_date),
                    "last_payment_date": last_payment_date,
                })
                total_debt_amount += balance_due

        # Calculate the total debt in the database (without date filter)
        all_bookings = db.query(booking_models.Booking).filter(
            booking_models.Booking.status != "cancelled",
            booking_models.Booking.payment_status != "complimentary"
        ).all()

        for booking in all_bookings:
            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number
            ).first()
            if not room:
                continue

            total_due = booking.number_of_days * room.amount
            all_payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.status != "voided"
            ).all()

            total_paid = sum(payment.amount_paid for payment in all_payments)
            total_discount = sum(payment.discount_allowed or 0 for payment in all_payments)
            total_database_debt += max(total_due - (total_paid + total_discount), 0)

        # Raise an exception if no debtors are found
        if not debtor_list:
            raise HTTPException(status_code=404, detail="No debtors found for the given criteria.")

        # Sort debtor list in descending order based on the last payment date
        debtor_list.sort(
            key=lambda x: x["last_payment_date"] if x["last_payment_date"] else datetime.min.replace(tzinfo=lagos_tz),
            reverse=True
        )

        return {
            "total_debtors": len(debtor_list),
            "total_current_debt": total_debt_amount,  # Current total debt within date range
            "total_gross_debt": total_database_debt,  # Total debt across entire database
            "debtors": debtor_list,
        }

    except Exception as e:
        logger.error(f"Error retrieving debtor list: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail="Debtor records not found",
        )

@router.get("/outstanding")
def list_outstanding_bookings(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:
        # Fetch all bookings that are not cancelled or complimentary or fully paid
        bookings = db.query(booking_models.Booking).filter(
            booking_models.Booking.status != "cancelled",
            booking_models.Booking.payment_status.notin_([
                "fully paid", "complimentary", "void"
            ])
        ).all()


        if not bookings:
            raise HTTPException(status_code=404, detail="No outstanding bookings found.")

        outstanding = []

        for booking in bookings:
            room = db.query(room_models.Room).filter(
                room_models.Room.room_number == booking.room_number
            ).first()

            if not room:
                continue

            total_due = booking.number_of_days * room.amount

            all_payments = db.query(payment_models.Payment).filter(
                payment_models.Payment.booking_id == booking.id,
                payment_models.Payment.status != "voided"
            ).all()

            total_paid = sum(p.amount_paid for p in all_payments)
            total_discount = sum(p.discount_allowed or 0 for p in all_payments)

            balance_due = total_due - (total_paid + total_discount)
            


            if balance_due > 0:
                outstanding.append({
                    "booking_id": booking.id,
                    "guest_name": booking.guest_name,
                    "room_number": booking.room_number,
                    "room_price": room.amount,
                    "number_of_days": booking.number_of_days,
                    "total_due": total_due,
                    "total_paid": total_paid,
                    "discount_allowed": total_discount,
                    "amount_due": balance_due,
                    "booking_date": make_timezone_aware(booking.booking_date),
                    "payment_status": booking.payment_status,
                })

        if not outstanding:
            raise HTTPException(status_code=404, detail="No outstanding balances found.")

        outstanding.sort(key=lambda x: x["booking_date"], reverse=True)

        

        total_outstanding_balance = sum(item["amount_due"] for item in outstanding)

        return {
            "total_outstanding": len(outstanding),
            "total_outstanding_balance": total_outstanding_balance,
            "outstanding_bookings": outstanding
        }


    except Exception as e:
        logger.error(f"Error in list_outstanding_bookings: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not fetch outstanding bookings.")


@router.get("/{payment_id}")
def get_payment_by_id(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Get payment details by payment ID.
    """
    try:
        # Log the request
        logger.info(f"Fetching payment with ID: {payment_id}")
        
        # Retrieve payment by ID using the CRUD function
        payment = crud.get_payment_by_id(db, payment_id)
        
        # Check if the payment exists
        if not payment:
            logger.warning(f"Payment with ID {payment_id} not found.")
            raise HTTPException(
                status_code=404,
                detail=f"Payment with ID {payment_id} not found."
            )
        
        # Log the retrieved payment
        logger.info(f"Retrieved payment details: {payment}")

        # Return the payment details
        return {
            "payment_id": payment.id,
            "guest_name": payment.guest_name,
            "room_number": payment.room_number,
            #"booking_cost": payment.booking_cost,
            "amount_paid": payment.amount_paid,
            "discount_allowed": payment.discount_allowed,
            "balance_due": payment.balance_due,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date.isoformat(),
            "status": payment.status,
            "void_date": payment.void_date,
            "booking_id": payment.booking_id,
            "created_by": payment.created_by,
        }

    except HTTPException as e:
        logger.error(f"HTTPException occurred: {e.detail}")
        raise e  # Re-raise the HTTPException
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Error fetching payment with ID {payment_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving the payment."
        )



@router.put("/void/{payment_id}/")
def void_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        # Retrieve the payment record by ID
        payment = crud.get_payment_by_id(db, payment_id)
        if not payment:
            logger.warning(f"Payment with ID {payment_id} does not exist.")
            raise HTTPException(
                status_code=404,
                detail=f"Payment with ID {payment_id} not found."
            )

        # Check if the payment is already voided
        if payment.status == "voided":
            raise HTTPException(status_code=400, detail="Payment is already voided.")

        # Update payment status to "voided" and set void_date
        payment.status = "voided"

        lagos_tz = pytz.timezone("Africa/Lagos")

# Store current timestamp in Africa/Lagos timezone
        payment.void_date = datetime.now(lagos_tz)

        # Retrieve the associated booking using payment.booking_id
        booking = db.query(models.Booking).filter(models.Booking.id == payment.booking_id).first()

        if booking:
            # Change payment_status in Booking to "pending"
            booking.payment_status = "pending"

        # Commit changes
        db.commit()

        logger.info(f"Payment with ID {payment_id} marked as void. Booking payment status set to pending.")

        return {
            "message": f"Payment with ID {payment_id} has been voided. Booking ID {payment.booking_id} payment status is now pending.",
            "payment_details": {
                "payment_id": payment.id,
                "status": payment.status,
                "void_date": payment.void_date.strftime("%Y-%m-%d %H:%M:%S"),  # Format date for readability
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
        logger.error(f"Error marking payment as void: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while marking the payment as void: {str(e)}"
        )


