from fastapi import APIRouter, HTTPException, Depends
from fastapi import Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import date
from app.database import get_db
from typing import Optional  # Import for optional parameters
from app.users.auth import get_current_user
from sqlalchemy import or_
from sqlalchemy import and_
from app.users.permissions import role_required  # 👈 permission helper
from app.rooms import models as room_models  # Import room models
from app.bookings import schemas, models as  booking_models
from app.payments import models as payment_models
from app.bookings.schemas import BookingOut
from app.users import schemas as user_schemas
from loguru import logger
from datetime import datetime, time
import os
import shutil
from fastapi import UploadFile, File, Form
from typing import Optional, Union
import uuid

router = APIRouter()

# Set up logging
logger.add("app.log", rotation="500 MB", level="DEBUG")


#log_path = os.path.join(os.getenv("LOCALAPPDATA", "C:\\Temp"), "app.log")
#logger.add(log_path, rotation="500 MB", level="DEBUG")

@router.post("/create/")
def create_booking(
    room_number: str = Form(...),
    guest_name: str = Form(...),
    gender: str = Form(...),
    mode_of_identification: str = Form(...),
    identification_number: Optional[str] = Form(None),
    address: str = Form(...),
    arrival_date: date = Form(...),
    departure_date: date = Form(...),
    booking_type: str = Form(...),
    phone_number: str = Form(...),
    vehicle_no: Optional[str] = Form(None),

    attachment_file: Optional[UploadFile] = File(None),
    attachment_str: Optional[str] = Form(None),

    business_id: Optional[int] = Form(None),

    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):

    normalized_room_number = room_number.strip().lower()

    # -------------------------------
    # Determine business scope
    # -------------------------------
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Super admin must provide business_id."
            )
    else:
        effective_business_id = current_user.business_id

    # -------------------------------
    # Find room
    # -------------------------------
    room = (
        db.query(room_models.Room)
        .filter(
            func.lower(room_models.Room.room_number) == normalized_room_number,
            room_models.Room.business_id == effective_business_id
        )
        .first()
    )

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.status == "maintenance":
        raise HTTPException(status_code=400, detail="Room is under maintenance.")

    # -------------------------------
    # Prevent early same-day booking
    # -------------------------------
    if arrival_date == date.today():
        now = datetime.now().time()

        overlapping_departure = (
            db.query(booking_models.Booking)
            .filter(
                func.lower(booking_models.Booking.room_number) == normalized_room_number,
                booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
                booking_models.Booking.departure_date == arrival_date,
                booking_models.Booking.business_id == effective_business_id
            )
            .first()
        )

        if overlapping_departure and now < time(12, 0):
            raise HTTPException(
                status_code=400,
                detail=f"Room {room.room_number} cannot be booked until after 12:00 PM."
            )

    # -------------------------------
    # Attachment handling
    # -------------------------------
    attachment_path = None

    if attachment_file and attachment_file.filename:
        upload_dir = "uploads/attachments/"
        os.makedirs(upload_dir, exist_ok=True)

        file_location = os.path.join(upload_dir, attachment_file.filename)

        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(attachment_file.file, buffer)

        attachment_path = f"/uploads/attachments/{attachment_file.filename}"

    elif attachment_str:
        attachment_path = attachment_str

    today = date.today()

    # -------------------------------
    # Validate booking type
    # -------------------------------
    if departure_date <= arrival_date:
        raise HTTPException(
            status_code=400,
            detail="Departure date must be later than arrival date."
        )

    if booking_type == "checked-in" and arrival_date != today:
        raise HTTPException(
            status_code=400,
            detail="Checked-in bookings must start today."
        )

    if booking_type == "reservation" and arrival_date <= today:
        raise HTTPException(
            status_code=400,
            detail="Reservation must be a future date."
        )

    if booking_type == "complimentary" and arrival_date != today:
        raise HTTPException(
            status_code=400,
            detail="Complimentary booking must start today."
        )

    # -------------------------------
    # Overlapping booking check
    # -------------------------------
    overlapping_booking = (
        db.query(booking_models.Booking)
        .filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.business_id == effective_business_id,
            booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
            and_(
                booking_models.Booking.arrival_date < departure_date,
                booking_models.Booking.departure_date > arrival_date
            )
        )
        .first()
    )

    if overlapping_booking:
        raise HTTPException(
            status_code=400,
            detail=f"Room {room.room_number} already booked. Booking ID: {overlapping_booking.id}"
        )

    # -------------------------------
    # Calculate pricing
    # -------------------------------
    number_of_days = (departure_date - arrival_date).days

    if booking_type == "complimentary":
        booking_cost = 0
        payment_status = "complimentary"
        booking_status = "complimentary"
    else:
        booking_cost = room.amount * number_of_days
        payment_status = "pending"
        booking_status = "reserved" if booking_type == "reservation" else "checked-in"

    # -------------------------------
    # Create booking
    # -------------------------------
    try:

        new_booking = booking_models.Booking(
            business_id=effective_business_id,
            room_id=room.id,
            room_number=room.room_number,  # ✅ FIXED
            guest_name=guest_name,
            gender=gender,
            mode_of_identification=mode_of_identification,
            identification_number=identification_number,
            address=address,
            arrival_date=arrival_date,
            departure_date=departure_date,
            booking_type=booking_type,
            phone_number=phone_number,
            number_of_days=number_of_days,
            status=booking_status,
            room_price=room.amount if booking_type != "complimentary" else 0,
            booking_cost=booking_cost,
            payment_status=payment_status,
            created_by=current_user.username,
            vehicle_no=vehicle_no,
            attachment=attachment_path,
        )

        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)

        # -------------------------------
        # Update room status
        # -------------------------------
        room.status = booking_status
        db.commit()

        return {
            "message": f"Booking created successfully for room {room.room_number}.",
            "booking_details": {
                "id": new_booking.id,
                "business_id": new_booking.business_id,
                "room_number": new_booking.room_number,
                "guest_name": new_booking.guest_name,
                "arrival_date": new_booking.arrival_date,
                "departure_date": new_booking.departure_date,
                "status": new_booking.status,
                "booking_cost": new_booking.booking_cost,
                "payment_status": new_booking.payment_status,
                "created_by": new_booking.created_by,
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )



@router.get("/reservations/alerts")
def get_active_reservations(
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    today = date.today()

    # -------------------------------
    # Determine business scope
    # -------------------------------
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
    else:
        effective_business_id = current_user.business_id

    query = db.query(booking_models.Booking).filter(
        booking_models.Booking.status == "reserved",
        booking_models.Booking.arrival_date >= today,
        booking_models.Booking.deleted == False
    )

    if effective_business_id:
        query = query.filter(
            booking_models.Booking.business_id == effective_business_id
        )

    reservations = query.all()

    count = len(reservations)

    return {
        "active_reservations": count > 0,
        "count": count
    }




@router.get("/reservation-alerts", response_model=list[BookingOut])
def get_reservation_alerts(
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:
        today = date.today()

        # -------------------------------
        # Determine business scope
        # -------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.status == "reserved",
            booking_models.Booking.deleted == False,
            booking_models.Booking.arrival_date >= today
        )

        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        reservations = (
            query
            .order_by(booking_models.Booking.arrival_date)
            .all()
        )

        return [
            BookingOut(
                id=r.id,
                room_number=r.room_number,  # safer since it's stored in booking
                guest_name=r.guest_name,
                address=r.address,
                arrival_date=r.arrival_date,
                departure_date=r.departure_date,
                booking_type=r.booking_type,
                phone_number=r.phone_number,
                status=r.status,
                payment_status=r.payment_status,
                number_of_days=r.number_of_days,
                booking_cost=r.booking_cost,
                created_by=r.created_by
            )
            for r in reservations
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching reservations: {str(e)}"
        )




@router.get("/list")
def list_bookings(
    start_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="date format-yyyy-mm-dd"),
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # -----------------------------------
        # Validate date range
        # -----------------------------------
        if start_date and end_date and start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date cannot be later than end date"
            )

        start_datetime = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_datetime = datetime.combine(end_date, datetime.max.time()) if end_date else None

        # -----------------------------------
        # Base query
        # -----------------------------------
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.status != "cancel",
            booking_models.Booking.deleted == False
        )

        # -----------------------------------
        # Multi-tenant filter
        # -----------------------------------
        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        # -----------------------------------
        # Date filters
        # -----------------------------------
        if start_datetime:
            query = query.filter(
                booking_models.Booking.booking_date >= start_datetime
            )

        if end_datetime:
            query = query.filter(
                booking_models.Booking.booking_date <= end_datetime
            )

        # -----------------------------------
        # Fetch bookings
        # -----------------------------------
        bookings = query.order_by(
            booking_models.Booking.booking_date.desc()
        ).all()

        # -----------------------------------
        # Cost calculation
        # -----------------------------------
        valid_bookings = [
            booking for booking in bookings
            if booking.status in ["checked-in", "checked-out", "reserved"]
        ]

        total_booking_cost = sum(
            booking.booking_cost for booking in valid_bookings
        )

        # -----------------------------------
        # Format response
        # -----------------------------------
        formatted_bookings = [
            {
                "id": booking.id,
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
                "gender": booking.gender,
                "arrival_date": booking.arrival_date,
                "departure_date": booking.departure_date,
                "number_of_days": booking.number_of_days,
                "booking_type": booking.booking_type,
                "phone_number": booking.phone_number,
                "booking_date": booking.booking_date,
                "status": booking.status,
                "payment_status": booking.payment_status,
                "mode_of_identification": booking.mode_of_identification,
                "identification_number": booking.identification_number,
                "address": booking.address,
                "booking_cost": booking.booking_cost,
                "created_by": booking.created_by,
                "vehicle_no": booking.vehicle_no,
                "attachment": booking.attachment
            }
            for booking in bookings
        ]

        return {
            "total_bookings": len(formatted_bookings),
            "total_booking_cost": total_booking_cost,
            "bookings": formatted_bookings
        }

    except Exception as e:
        logger.error(f"Error retrieving bookings: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    
    

@router.get("/search-guest/")
def search_guest(
    guest_name: str = Query(...),
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # -----------------------------------
        # Base query
        # -----------------------------------
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.guest_name.ilike(f"%{guest_name}%"),
            booking_models.Booking.deleted == False
        )

        # -----------------------------------
        # Multi-tenant filter
        # -----------------------------------
        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        guests = query.order_by(
            booking_models.Booking.id.desc()
        ).all()

        if not guests:
            raise HTTPException(status_code=404, detail="Guest not found")

        result = [
            {
                "gender": guest.gender,
                "phone_number": guest.phone_number,
                "address": guest.address,
                "mode_of_identification": guest.mode_of_identification,
                "identification_number": guest.identification_number,
                "booking_type": guest.booking_type,
                "vehicle_no": guest.vehicle_no,
                "arrival_date": guest.arrival_date,
                "departure_date": guest.departure_date,
                "attachment": guest.attachment,
            }
            for guest in guests
        ]

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error searching guest: {str(e)}"
        )



@router.get("/status")
def list_bookings_by_status(
    status: Optional[str] = Query(None, description="Booking status to filter by (checked-in, reserved, checked-out, cancelled, complimentary)"),
    start_date: Optional[date] = Query(None, description="Filter by booking date (start) in format yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="Filter by booking date (end) in format yyyy-mm-dd"),
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # -----------------------------------
        # Base query
        # -----------------------------------
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.deleted == False
        )

        # -----------------------------------
        # Multi-tenant filter
        # -----------------------------------
        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        # -----------------------------------
        # Status filter
        # -----------------------------------
        if status and status.lower() != "all":
            if status.lower() == "complimentary":
                query = query.filter(
                    booking_models.Booking.payment_status == "complimentary"
                )
            else:
                query = query.filter(
                    booking_models.Booking.status == status
                )

        # -----------------------------------
        # Date filters
        # -----------------------------------
        if start_date:
            query = query.filter(
                booking_models.Booking.booking_date >= datetime.combine(start_date, datetime.min.time())
            )

        if end_date:
            query = query.filter(
                booking_models.Booking.booking_date <= datetime.combine(end_date, datetime.max.time())
            )

        # -----------------------------------
        # Fetch bookings
        # -----------------------------------
        bookings = query.order_by(
            booking_models.Booking.booking_date.desc()
        ).all()

        if not bookings:
            return {"message": "No bookings found for the given criteria."}

        # -----------------------------------
        # Format bookings
        # -----------------------------------
        formatted_bookings = [
            {
                "id": booking.id,
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
                "gender": booking.gender,
                "arrival_date": booking.arrival_date,
                "departure_date": booking.departure_date,
                "number_of_days": booking.number_of_days,
                "phone_number": booking.phone_number,
                "booking_date": booking.booking_date,
                "status": booking.status,
                "booking_type": booking.booking_type,
                "payment_status": booking.payment_status,
                "mode_of_identification": booking.mode_of_identification,
                "identification_number": booking.identification_number,
                "address": booking.address,
                "booking_cost": booking.booking_cost,
                "created_by": booking.created_by,
                "vehicle_no": booking.vehicle_no,
                "attachment": booking.attachment
            }
            for booking in bookings
        ]

        # -----------------------------------
        # Calculate total cost
        # -----------------------------------
        total_cost = sum(booking.booking_cost for booking in bookings)

        return {
            "total_bookings": len(formatted_bookings),
            "total_cost": total_cost,
            "bookings": formatted_bookings
        }

    except Exception as e:
        logger.error(f"Error retrieving bookings by status: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )





@router.get("/search")
def search_guest_name(
    guest_name: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # -----------------------------------
        # Base query
        # -----------------------------------
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.guest_name.ilike(f"%{guest_name}%"),
            booking_models.Booking.deleted == False
        )

        # -----------------------------------
        # Multi-tenant filter
        # -----------------------------------
        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        # -----------------------------------
        # Date filters
        # -----------------------------------
        if start_date:
            query = query.filter(
                booking_models.Booking.booking_date >= datetime.combine(start_date, datetime.min.time())
            )

        if end_date:
            query = query.filter(
                booking_models.Booking.booking_date <= datetime.combine(end_date, datetime.max.time())
            )

        # -----------------------------------
        # Order results
        # -----------------------------------
        bookings = query.order_by(
            booking_models.Booking.booking_date.desc()
        ).all()

        if not bookings:
            raise HTTPException(
                status_code=404,
                detail=f"No bookings found for guest '{guest_name}'."
            )

        # -----------------------------------
        # Calculate total cost
        # -----------------------------------
        total_cost = sum(
            b.booking_cost or 0
            for b in bookings
            if (b.status or "").lower() not in ("cancelled", "complimentary")
        )

        # -----------------------------------
        # Format response
        # -----------------------------------
        formatted_bookings = [
            {
                "id": b.id,
                "room_number": b.room_number,
                "guest_name": b.guest_name,
                "gender": b.gender,
                "arrival_date": b.arrival_date,
                "departure_date": b.departure_date,
                "number_of_days": b.number_of_days,
                "booking_type": b.booking_type,
                "phone_number": b.phone_number,
                "booking_date": b.booking_date,
                "status": b.status,
                "payment_status": b.payment_status,
                "mode_of_identification": b.mode_of_identification,
                "identification_number": b.identification_number,
                "address": b.address,
                "booking_cost": b.booking_cost,
                "created_by": b.created_by,
                "vehicle_no": b.vehicle_no,
                "attachment": b.attachment
            }
            for b in bookings
        ]

        return {
            "total_bookings": len(formatted_bookings),
            "total_booking_cost": total_cost,
            "bookings": formatted_bookings
        }

    except Exception as e:
        logger.error(f"Error searching bookings for guest '{guest_name}': {str(e)}")

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )




@router.get("/{booking_id}")
def list_booking_by_id(
    booking_id: int,
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):

    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        # -----------------------------------
        # Build query
        # -----------------------------------
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.id == booking_id,
            booking_models.Booking.deleted == False
        )

        # -----------------------------------
        # Multi-tenant filter
        # -----------------------------------
        if effective_business_id:
            query = query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        booking = query.first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail=f"Booking with ID {booking_id} not found."
            )

        # -----------------------------------
        # Format response
        # -----------------------------------
        formatted_booking = {
            "id": booking.id,
            "room_number": booking.room_number,
            "guest_name": booking.guest_name,
            "gender": booking.gender,
            "arrival_date": booking.arrival_date,
            "departure_date": booking.departure_date,
            "number_of_days": booking.number_of_days,
            "booking_type": booking.booking_type,
            "phone_number": booking.phone_number,
            "booking_date": booking.booking_date,
            "status": booking.status,
            "payment_status": booking.payment_status,
            "mode_of_identification": booking.mode_of_identification,
            "identification_number": booking.identification_number,
            "address": booking.address,
            "booking_cost": booking.booking_cost,
            "created_by": booking.created_by,
            "vehicle_no": booking.vehicle_no
        }

        return {
            "message": f"Booking details for ID {booking_id} retrieved successfully.",
            "booking": formatted_booking
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving booking: {str(e)}"
        )



@router.get("/room/{room_number}")
def list_bookings_by_room(
    room_number: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Retrieve bookings associated with a specific room number.
    Optional date range returns bookings that overlap with the period.
    """

    try:

        # -----------------------------------
        # Determine business scope
        # -----------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
        else:
            effective_business_id = current_user.business_id

        normalized_room_number = room_number.lower()

        # -----------------------------------
        # Verify room exists within business
        # -----------------------------------
        room_query = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == normalized_room_number
        )

        if effective_business_id:
            room_query = room_query.filter(
                room_models.Room.business_id == effective_business_id
            )

        room_exists = room_query.first()

        if not room_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Room '{room_number}' does not exist."
            )

        # -----------------------------------
        # Build bookings query
        # -----------------------------------
        bookings_query = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.deleted == False
        )

        if effective_business_id:
            bookings_query = bookings_query.filter(
                booking_models.Booking.business_id == effective_business_id
            )

        # -----------------------------------
        # Date overlap filtering
        # -----------------------------------
        if start_date and end_date:
            bookings_query = bookings_query.filter(
                and_(
                    booking_models.Booking.arrival_date <= end_date,
                    booking_models.Booking.departure_date >= start_date
                )
            )

        bookings = bookings_query.order_by(
            booking_models.Booking.booking_date.desc()
        ).all()

        if not bookings:
            raise HTTPException(
                status_code=404,
                detail=f"No bookings found for room '{room_number}' in the selected period."
            )

        # -----------------------------------
        # Calculate total cost
        # -----------------------------------
        total_booking_cost = sum(
            b.booking_cost or 0
            for b in bookings
            if (b.status or "").lower() not in ("cancelled", "complimentary")
        )

        # -----------------------------------
        # Format response
        # -----------------------------------
        formatted_bookings = [
            {
                "id": b.id,
                "room_number": b.room_number,
                "guest_name": b.guest_name,
                "gender": b.gender,
                "arrival_date": b.arrival_date,
                "departure_date": b.departure_date,
                "number_of_days": b.number_of_days,
                "booking_type": b.booking_type,
                "phone_number": b.phone_number,
                "booking_date": b.booking_date,
                "status": b.status,
                "payment_status": b.payment_status,
                "mode_of_identification": b.mode_of_identification,
                "identification_number": b.identification_number,
                "address": b.address,
                "booking_cost": b.booking_cost,
                "created_by": b.created_by,
                "vehicle_no": b.vehicle_no,
                "attachment": b.attachment
            }
            for b in bookings
        ]

        return {
            "room_number": normalized_room_number,
            "total_bookings": len(formatted_bookings),
            "total_booking_cost": total_booking_cost,
            "bookings": formatted_bookings
        }

    except Exception as e:
        logger.error(f"Error retrieving bookings for room {room_number}: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving bookings: {str(e)}"
        )





@router.put("/update/")
def update_booking(
    booking_id: int = Form(...),
    room_number: str = Form(...),
    guest_name: str = Form(...),
    gender: str = Form(...),
    mode_of_identification: str = Form(...),
    identification_number: Optional[str] = Form(None),
    address: str = Form(...),
    arrival_date: date = Form(...),
    departure_date: date = Form(...),
    booking_type: str = Form(...),
    phone_number: str = Form(...),
    vehicle_no: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    attachment_str: Optional[str] = Form(None),
    business_id: Optional[int] = Form(None),  # optional for super_admin
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))
):
    try:
        today = date.today()

        # -------------------------------
        # Business Scope
        # -------------------------------
        if "super_admin" in current_user.roles:
            effective_business_id = business_id
            if not effective_business_id:
                raise HTTPException(
                    status_code=400,
                    detail="Super admin must provide business_id to update a booking."
                )
        else:
            effective_business_id = current_user.business_id

        # -------------------------------
        # Validate dates & booking type
        # -------------------------------
        if departure_date <= arrival_date:
            raise HTTPException(status_code=400, detail="Departure date must be after arrival date.")

        if booking_type == "checked-in" and arrival_date != today:
            raise HTTPException(status_code=400, detail="Checked-in bookings can only be for today.")

        if booking_type == "reservation" and arrival_date <= today:
            raise HTTPException(status_code=400, detail="Reservations must be for a future date.")

        if booking_type == "complimentary" and arrival_date != today:
            raise HTTPException(status_code=400, detail="Complimentary bookings can only be for today.")

        # -------------------------------
        # Fetch booking to update
        # -------------------------------
        booking = db.query(booking_models.Booking).filter(
            booking_models.Booking.id == booking_id,
            booking_models.Booking.deleted == False,
            booking_models.Booking.business_id == effective_business_id
        ).first()

        if not booking:
            raise HTTPException(status_code=404, detail=f"Booking ID {booking_id} not found.")

        # -------------------------------
        # Validate room
        # -------------------------------
        normalized_room_number = room_number.strip().lower()
        room = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == normalized_room_number,
            room_models.Room.business_id == effective_business_id
        ).first()
        if not room:
            raise HTTPException(status_code=404, detail=f"Room {room_number} not found in this business.")

        # -------------------------------
        # Check overlapping bookings
        # -------------------------------
        overlapping_booking = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.id != booking_id,
            booking_models.Booking.deleted == False,
            booking_models.Booking.business_id == effective_business_id,
            booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
            and_(
                booking_models.Booking.arrival_date < departure_date,
                booking_models.Booking.departure_date > arrival_date
            )
        ).first()

        if overlapping_booking:
            raise HTTPException(
                status_code=400,
                detail=f"Room {room_number} is already booked for the requested dates. Check Booking ID: {overlapping_booking.id}"
            )

        # -------------------------------
        # Compute number of days & cost
        # -------------------------------
        number_of_days = (departure_date - arrival_date).days
        if number_of_days <= 0:
            raise HTTPException(status_code=400, detail="Number of days must be greater than zero.")

        # Determine status and cost
        if booking_type == "complimentary":
            booking_cost = 0
            payment_status = "complimentary"
            status = "checked-in"
        else:
            booking_cost = room.amount * number_of_days
            payment_status = booking.payment_status or "pending"
            status = "reserved" if booking_type == "reservation" else "checked-in"

        # -------------------------------
        # Handle attachment
        # -------------------------------
        attachment_path = booking.attachment  # keep existing
        if attachment and attachment.filename:
            upload_dir = "uploads/attachments/"
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, attachment.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(attachment.file, buffer)
            attachment_path = f"/uploads/attachments/{attachment.filename}"
        elif attachment_str:
            attachment_path = attachment_str
        else:
            attachment_path = None

        # -------------------------------
        # Update booking fields
        # -------------------------------
        booking.room_number = room.room_number
        booking.guest_name = guest_name
        booking.gender = gender
        booking.mode_of_identification = mode_of_identification
        booking.identification_number = identification_number
        booking.address = address
        booking.arrival_date = arrival_date
        booking.departure_date = departure_date
        booking.booking_type = booking_type
        booking.phone_number = phone_number
        booking.number_of_days = number_of_days
        booking.status = status
        booking.room_price = room.amount if booking_type != "complimentary" else 0
        booking.booking_cost = booking_cost
        booking.payment_status = payment_status
        booking.vehicle_no = vehicle_no
        booking.attachment = attachment_path
        booking.created_by = current_user.username

        db.commit()
        db.refresh(booking)

        return {
            "message": f"Booking updated successfully for room {room.room_number}.",
            "updated_booking": {
                "id": booking.id,
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
                "gender": booking.gender,
                "address": booking.address,
                "mode_of_identification": booking.mode_of_identification,
                "identification_number": booking.identification_number,
                "room_price": booking.room_price,
                "arrival_date": booking.arrival_date,
                "departure_date": booking.departure_date,
                "booking_type": booking.booking_type,
                "phone_number": booking.phone_number,
                "number_of_days": booking.number_of_days,
                "status": booking.status,
                "booking_cost": booking.booking_cost,
                "payment_status": booking.payment_status,
                "vehicle_no": booking.vehicle_no,
                "attachment": booking.attachment,
            },
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating booking ID {booking_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")





@router.get("/booking/{booking_id}")
def get_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Retrieve a single booking by ID, including all details in the updated structure.
    Respects multi-tenant access for normal admins; super_admins can view any business booking.
    """
    # -------------------------------
    # Determine effective business scope
    # -------------------------------
    booking_query = db.query(booking_models.Booking).filter(
        booking_models.Booking.id == booking_id,
        booking_models.Booking.deleted == False
    )

    if "super_admin" not in current_user.roles:
        booking_query = booking_query.filter(booking_models.Booking.business_id == current_user.business_id)

    booking = booking_query.first()

    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking with ID {booking_id} not found.")

    # -------------------------------
    # Format the booking for response
    # -------------------------------
    formatted_booking = {
        "id": booking.id,
        "business_id": booking.business_id,
        "room_number": booking.room_number,
        "guest_name": booking.guest_name,
        "gender": booking.gender,
        "mode_of_identification": booking.mode_of_identification,
        "identification_number": booking.identification_number,
        "address": booking.address,
        "arrival_date": booking.arrival_date,
        "departure_date": booking.departure_date,
        "number_of_days": booking.number_of_days,
        "booking_type": booking.booking_type,
        "phone_number": booking.phone_number,
        "vehicle_no": booking.vehicle_no,
        "status": booking.status,
        "room_price": booking.room_price,
        "booking_cost": booking.booking_cost,
        "payment_status": booking.payment_status,
        "attachment": booking.attachment,
        "created_by": booking.created_by,
        "booking_date": booking.booking_date,
    }

    return {
        "message": f"Booking details for ID {booking_id} retrieved successfully.",
        "booking": formatted_booking
    }



    
@router.put("/{room_number}/checkout")
def guest_checkout(
    room_number: str,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Check out a guest by room number. 
    Only allows checkout if the booking is active today (current date is within arrival and departure).
    Respects multi-tenant access for normal admins.
    """
    try:
        today = date.today()
        normalized_room_number = room_number.strip().lower()

        # Step 1: Verify room exists
        room = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == normalized_room_number
        ).first()
        if not room:
            raise HTTPException(status_code=404, detail=f"Room number {room_number} not found.")

        # Step 2: Fetch active booking for this room
        booking_query = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"]),
            booking_models.Booking.arrival_date <= today,
            booking_models.Booking.departure_date >= today,
            booking_models.Booking.deleted == False
        )

        # Restrict by business for non-super_admin
        if "super_admin" not in current_user.roles:
            booking_query = booking_query.filter(booking_models.Booking.business_id == current_user.business_id)

        booking = booking_query.first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail=f"No active booking found for room {room_number} valid for today."
            )

        # Step 3: Update statuses
        booking.status = "checked-out"
        room.status = "available"

        db.commit()
        db.refresh(booking)
        db.refresh(room)

        # Step 4: Format response
        formatted_booking = {
            "id": booking.id,
            "room_number": booking.room_number,
            "guest_name": booking.guest_name,
            "status": booking.status,
            "arrival_date": booking.arrival_date,
            "departure_date": booking.departure_date,
            "booking_type": booking.booking_type,
            "payment_status": booking.payment_status,
            "booking_cost": booking.booking_cost,
            "created_by": booking.created_by,
        }

        return {
            "message": f"Guest checked out successfully for room {room_number}.",
            "room_status": room.status,
            "booking": formatted_booking
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during checkout: {str(e)}"
        )



@router.get("/bookings/cancellable")
def list_cancellable_bookings(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    List bookings eligible for cancellation:
    - Status: 'checked-in', 'reserved', or 'complimentary'
    - Payment status: Not 'fully paid' or 'part payment'
    - Dates: Current or future bookings (arrival_date >= today)
    - Excludes soft-deleted bookings
    """
    try:
        today = date.today()

        # Base query
        bookings_query = db.query(booking_models.Booking).filter(
            booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"]),
            booking_models.Booking.payment_status.notin_(["fully paid", "part payment"]),
            or_(
                and_(
                    booking_models.Booking.arrival_date <= today,
                    booking_models.Booking.departure_date >= today
                ),
                booking_models.Booking.arrival_date > today
            ),
            booking_models.Booking.deleted == False
        )

        # Restrict to current user's business if not super_admin
        if "super_admin" not in current_user.roles:
            bookings_query = bookings_query.filter(booking_models.Booking.business_id == current_user.business_id)

        # Order by booking_date descending
        bookings = bookings_query.order_by(booking_models.Booking.booking_date.desc()).all()

        # Format bookings
        formatted_bookings = [
            {
                "booking_id": b.id,
                "room_number": b.room_number,
                "guest_name": b.guest_name,
                "arrival_date": b.arrival_date,
                "departure_date": b.departure_date,
                "number_of_days": b.number_of_days,
                "booking_date": b.booking_date,
                "status": b.status,
                "payment_status": b.payment_status,
                "booking_cost": b.booking_cost,
                "created_by": b.created_by,
                "vehicle_no": b.vehicle_no,
                "attachment": b.attachment
            }
            for b in bookings
        ]

        total_cost = sum(b.booking_cost or 0 for b in bookings)

        return {
            "total_bookings": len(formatted_bookings),
            "total_booking_cost": total_cost,
            "bookings": formatted_bookings
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching cancellable bookings: {str(e)}"
        )



   
    
@router.post("/cancel/{booking_id}/")
def cancel_booking(
    booking_id: int,
    cancellation_reason: Optional[str] = Query(None, description="Reason for cancelling the booking"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Cancel a booking if no non-voided payment is tied to it.
    - Marks booking as 'cancelled' and soft-deletes it.
    - Updates room status to 'available'.
    """
    try:
        # Fetch the booking by ID, ensuring it's not already deleted
        booking = db.query(booking_models.Booking).filter(
            booking_models.Booking.id == booking_id,
            booking_models.Booking.deleted == False
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail=f"Booking with ID {booking_id} not found or already cancelled."
            )

        # Enforce multi-tenant: regular users can only cancel their own business bookings
        if "super_admin" not in current_user.roles and booking.business_id != current_user.business_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to cancel this booking."
            )

        # Check for non-voided payments
        payment = db.query(payment_models.Payment).filter(
            payment_models.Payment.booking_id == booking_id,
            payment_models.Payment.status != "voided"
        ).first()

        if payment:
            raise HTTPException(
                status_code=400,
                detail="Booking is tied to a non-voided payment. Cancel or void the payment first."
            )

        # Update booking and room
        booking.status = "cancelled"
        booking.deleted = True
        booking.cancellation_reason = cancellation_reason

        # Update room status to 'available'
        room = db.query(room_models.Room).filter(
            room_models.Room.room_number == booking.room_number,
            room_models.Room.business_id == booking.business_id
        ).first()

        if room:
            room.status = "available"

        db.commit()
        db.refresh(booking)
        if room:
            db.refresh(room)

        return {
            "message": f"Booking ID {booking_id} has been cancelled successfully.",
            "canceled_booking": {
                "id": booking.id,
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
                "status": booking.status,
                "cancellation_reason": booking.cancellation_reason,
                "room_status": room.status if room else "N/A",
                "created_by": booking.created_by,
                "arrival_date": booking.arrival_date,
                "departure_date": booking.departure_date,
                "booking_cost": booking.booking_cost,
                "payment_status": booking.payment_status,
                "booking_type": booking.booking_type
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while cancelling the booking: {str(e)}"
        )


