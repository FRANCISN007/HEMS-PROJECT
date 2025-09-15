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

    # Attachment file upload or reuse path
    attachment_file: Optional[UploadFile] = File(None),
    attachment_str: Optional[str] = Form(None),

    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    
    normalized_room_number = room_number.strip().lower()

    room = db.query(room_models.Room).filter(
        func.lower(room_models.Room.room_number) == normalized_room_number
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.status == "maintenance":
        raise HTTPException(status_code=400, detail="Room is under maintenance.")
    
    # Prevent booking before 12 noon on the departure date of an existing booking
    if arrival_date == date.today():
        now = datetime.now().time()
        overlapping_departure = (
            db.query(booking_models.Booking)
            .filter(
                func.lower(booking_models.Booking.room_number) == normalized_room_number,
                booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
                booking_models.Booking.departure_date == arrival_date
            )
            .first()
        )
        if overlapping_departure and now < time(12, 0):
            raise HTTPException(
                status_code=400,
                detail=f"Room {room.room_number} cannot be booked until after 12:00 PM today (departure date of a previous guest)."
            )

    attachment_path = None

    # ✅ Handle new file upload
    if attachment_file and attachment_file.filename:
        upload_dir = "uploads/attachments/"
        os.makedirs(upload_dir, exist_ok=True)
        file_location = os.path.join(upload_dir, attachment_file.filename)

        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(attachment_file.file, buffer)

        attachment_path = f"/uploads/attachments/{attachment_file.filename}"

    # ✅ Handle reusing previously uploaded file path
    elif attachment_str:
        attachment_path = attachment_str

    today = date.today()

    # Validate dates
    if departure_date <= arrival_date:
        raise HTTPException(
            status_code=400,
            detail="Departure date must be later than the arrival date.",
        )

    if booking_type == "checked-in" and arrival_date != today:
        raise HTTPException(
            status_code=400,
            detail="Checked-in bookings can only be created for today's date.",
        )

    if booking_type == "reservation" and arrival_date <= today:
        raise HTTPException(
            status_code=400,
            detail="Reservation bookings must be scheduled for a future date.",
        )

    if booking_type == "complimentary" and arrival_date != today:
        raise HTTPException(
            status_code=400,
            detail="Complimentary bookings can only be made for today's date.",
        )

    
    
    overlapping_booking = (
        db.query(booking_models.Booking)
        .filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
            and_(
                booking_models.Booking.arrival_date < departure_date,
                booking_models.Booking.departure_date > arrival_date,
            ),
        )
        .first()
    )

    if overlapping_booking:
        raise HTTPException(
            status_code=400,
            detail=f"Room {room_number} is already booked for the requested dates. "
                   f"Check Booking ID: {overlapping_booking.id}",
        )

    number_of_days = (departure_date - arrival_date).days

    if booking_type == "complimentary":
        booking_cost = 0
        payment_status = "complimentary"
        booking_status = "complimentary"
    else:
        booking_cost = room.amount * number_of_days
        payment_status = "pending"
        booking_status = "reserved" if booking_type == "reservation" else "checked-in"

    try:
        new_booking = booking_models.Booking(
            room_number=room.room_number,
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

        # ✅ Update room status to match booking status
        room.status = booking_status
        db.commit()


        return {
            "message": f"Booking created successfully for room {room.room_number}.",
            "booking_details": {
                "id": new_booking.id,
                "room_number": new_booking.room_number,
                "guest_name": new_booking.guest_name,
                "gender": new_booking.gender,
                "address": new_booking.address,
                "mode_of_identification": new_booking.mode_of_identification,
                "identification_number": new_booking.identification_number,
                "room_price": new_booking.room_price,
                "arrival_date": new_booking.arrival_date,
                "departure_date": new_booking.departure_date,
                "booking_type": new_booking.booking_type,
                "phone_number": new_booking.phone_number,
                "booking_date": new_booking.booking_date.isoformat(),
                "number_of_days": new_booking.number_of_days,
                "status": new_booking.status,
                "booking_cost": new_booking.booking_cost,
                "payment_status": new_booking.payment_status,
                "created_by": new_booking.created_by,
                "vehicle_no": new_booking.vehicle_no,
                "attachment": new_booking.attachment,
            },
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.get("/reservations/alerts")
def get_active_reservations(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    today = date.today()
    reservations = db.query(booking_models.Booking).filter(
        booking_models.Booking.status == "reserved",
        booking_models.Booking.arrival_date >= today,
        booking_models.Booking.deleted == False
    ).all()

    count = len(reservations)
    return {
        "active_reservations": count > 0,
        "count": count  # 🔹 Include count
    }





@router.get("/reservation-alerts", response_model=list[BookingOut])
def get_reservation_alerts(
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
    ):
    try:
        today = date.today()

        reservations = (
            db.query(booking_models.Booking)
            .filter(
                booking_models.Booking.status == "reserved",
                booking_models.Booking.deleted == False,
                booking_models.Booking.arrival_date >= today  # Only today and future
            )
            .order_by(booking_models.Booking.arrival_date)
            .all()
        )

        return [
            BookingOut(
                id=r.id,
                room_number=r.room.room_number if r.room else "N/A",
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
        raise HTTPException(status_code=500, detail=f"Error fetching reservations: {str(e)}")





@router.get("/list")
def list_bookings(
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

        # Set the start and end dates to the beginning and end of the day, if provided
        start_datetime = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_datetime = datetime.combine(end_date, datetime.max.time()) if end_date else None

        # Build the base query for bookings
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.status != "cancel"  # Exclude cancelled bookings
        )

        if start_datetime:
            query = query.filter(booking_models.Booking.booking_date >= start_datetime)
        if end_datetime:
            query = query.filter(booking_models.Booking.booking_date <= end_datetime)

        # Retrieve the bookings sorted by booking_date in descending order
        bookings = query.order_by(booking_models.Booking.booking_date.desc()).all()
        
        # Filter only checked-in bookings for total cost calculation
        #checked_in_bookings = [booking for booking in bookings if booking.status == "checked-in"]
        checked_in_bookings = [
            booking for booking in bookings if booking.status in ["checked-in", "checked-out", "reserved"]
        ]

        # Calculate total booking cost (excluding cancelled bookings)
        total_booking_cost = sum(booking.booking_cost for booking in checked_in_bookings)
        

        # Format bookings for response
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
            "total_booking_cost": total_booking_cost,  # Excluding canceled bookings
            "bookings": formatted_bookings,
        }

    except Exception as e:
        logger.error(f"Error retrieving bookings by date: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f" {str(e)}",
        )
    
    

@router.get("/search-guest/")
def search_guest(guest_name: str = Query(...), 
                 db: Session = Depends(get_db),
                 current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))   
                 ):
    guests = (
        db.query(booking_models.Booking)
        .filter(booking_models.Booking.guest_name.ilike(f"%{guest_name}%"))
        .order_by(booking_models.Booking.id.desc())
        .all()
    )

    if not guests:
        raise HTTPException(status_code=404, detail="Guest not found")

    result = []
    for guest in guests:
        result.append({
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
        })

    return result



@router.get("/status")
def list_bookings_by_status(
    status: Optional[str] = Query(None, description="Booking status to filter by (checked-in, reserved, checked-out, cancelled, complimentary)"),
    start_date: Optional[date] = Query(None, description="Filter by booking date (start) in format yyyy-mm-dd"),
    end_date: Optional[date] = Query(None, description="Filter by booking date (end) in format yyyy-mm-dd"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    try:
        # Build the base query
        query = db.query(booking_models.Booking)

        # Special condition: If searching for "complimentary", filter by payment_status
        # Only apply status filters if status is set and is NOT "none"
        if status and status.lower() != "all":
            if status.lower() == "complimentary":
                query = query.filter(booking_models.Booking.payment_status == "complimentary")
            else:
                query = query.filter(booking_models.Booking.status == status)

        # Apply date filters based on booking_date
        if start_date:
            query = query.filter(booking_models.Booking.booking_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(booking_models.Booking.booking_date <= datetime.combine(end_date, datetime.max.time()))


        # Execute the query and get the results
        bookings = query.order_by(booking_models.Booking.booking_date.desc()).all()

        # If no bookings are found, return a message with no bookings found
        if not bookings:
            return {"message": "No bookings found for the given criteria."}

        # Format the bookings to include necessary details
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
                "booking_date": booking.booking_date,  # Booking Date as the filter
                "status": booking.status,
                "booking_type": booking.booking_type,
                "payment_status": booking.payment_status,  # Includes payment status
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


        # Add this after formatted_bookings is created
        total_cost = sum(booking.booking_cost for booking in bookings)

        # Updated return block
        return {
            "total_bookings": len(formatted_bookings),
            "total_cost": total_cost,
            "bookings": formatted_bookings
        }


    except Exception as e:
        logger.error(f"Error retrieving bookings by status and booking date: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}",
        )




@router.get("/search")
def search_guest_name(
    guest_name: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
    
):
    try:
        query = db.query(booking_models.Booking).filter(
            booking_models.Booking.guest_name.ilike(f"%{guest_name}%")
        )

        # Optional date filters on booking_date
        if start_date:
            query = query.filter(booking_models.Booking.booking_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(booking_models.Booking.booking_date <= datetime.combine(end_date, datetime.max.time()))

        # ⬇️ Sort bookings by booking_date descending
        query = query.order_by(booking_models.Booking.booking_date.desc())

        bookings = query.all()

        if not bookings:
            raise HTTPException(status_code=404, detail=f"No bookings found for guest '{guest_name}'.")

        total_cost = sum(
            b.booking_cost or 0
            for b in bookings
            if b.status.lower() not in ("cancelled", "complimentary")
        )

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
            "bookings": formatted_bookings,
        }

    except Exception as e:
        logger.error(f"Error searching bookings for guest '{guest_name}': {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"{str(e)}",
        )



@router.get("/{booking_id}")
def list_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    
    # Fetch the booking by ID
    booking = db.query(booking_models.Booking).filter(
        booking_models.Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking with ID {booking_id} not found.")

    # Format the response
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
        "vehicle_no": booking.vehicle_no,
        #"attachment": booking.attachment
    }

    return {"message": f"Booking details for ID {booking_id} retrieved successfully.", "booking": formatted_booking}




@router.get("/room/{room_number}")
def list_bookings_by_room(
    room_number: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    List all bookings associated with a specific room number within an optional date range.
    The query ensures that any booking **active** within the specified dates is retrieved.
    """
    try:
        # Normalize room_number to lowercase
        normalized_room_number = room_number.lower()

        # Check if the room exists in the database (case-insensitive)
        room_exists = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == normalized_room_number
        ).first()

        if not room_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Room number {room_number} does not exist.",
            )

        # Build the base query for bookings (case-insensitive)
        bookings_query = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number
        )

        # Apply date range filter: Check if the booking **overlaps** with the given date range
        if start_date and end_date:
            bookings_query = bookings_query.filter(
                and_(
                    booking_models.Booking.arrival_date <= end_date,  # Booking starts before or on end_date
                    booking_models.Booking.departure_date >= start_date  # Booking ends after or on start_date
                )
            )

        # Fetch bookings
        # Sort by booking_date descending before fetching
        bookings = bookings_query.order_by(booking_models.Booking.booking_date.desc()).all()


        if not bookings:
            raise HTTPException(
                status_code=404,
                detail=f"No bookings found for room number {room_number} within the selected date range.",
            )
        

        # Exclude 'cancelled' for total entries
        #total_entries = len([b for b in bookings if b.status.lower() != ""])

        # Exclude 'cancelled' and 'complimentary' for total cost
        total_booking_cost = sum(
            b.booking_cost or 0
            for b in bookings
            if b.status.lower() not in ("cancelled", "complimentary")
        )

        # Format all bookings for display (including cancelled/complimentary)
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
                "attachment": b.attachment,
            }
            for b in bookings
        ]

        return {
            "room_number": normalized_room_number,
            #"total_entries": total_entries,
            "total_booking_cost": total_booking_cost,
            "bookings": formatted_bookings,
        }


    except Exception as e:
        logger.error(f"Error retrieving bookings for room {room_number}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"{str(e)}"
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
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["admin"]))

):
    # Check if the user is an admin
    #if current_user.roles != "admin":
        #raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        today = date.today()

        # ✅ Add these validations like in the create endpoint
        if departure_date <= arrival_date:
            raise HTTPException(
                status_code=400,
                detail="Departure date must be later than the arrival date.",
            )

        if booking_type == "checked-in" and arrival_date != today:
            raise HTTPException(
                status_code=400,
                detail="Checked-in bookings can only be created for today's date.",
            )

        if booking_type == "reservation" and arrival_date <= today:
            raise HTTPException(
                status_code=400,
                detail="Reservation bookings must be scheduled for a future date.",
            )

       

        # Fetch the existing booking from the database
        booking = db.query(booking_models.Booking).filter(booking_models.Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail=f"Booking with ID {booking_id} not found.")

        # Validate date logic (only arrival and departure date check remains)
        if departure_date <= arrival_date:
            raise HTTPException(status_code=400, detail="Departure date must be after arrival date.")

        # Normalize the room number and check if the room exists
        normalized_room_number = room_number.strip().lower()
        room = (
            db.query(room_models.Room)
            .filter(func.lower(room_models.Room.room_number) == normalized_room_number)
            .first()
        )
        if not room:
            raise HTTPException(status_code=404, detail=f"Room {room_number} not found.")

        # Check if there are any overlapping bookings in the same room for the given dates
        overlapping_booking = (
            db.query(booking_models.Booking)
            .filter(
                func.lower(booking_models.Booking.room_number) == normalized_room_number,
                booking_models.Booking.id != booking_id,
                booking_models.Booking.status.notin_(["checked-out", "cancelled"]),
                and_(
                    booking_models.Booking.arrival_date < departure_date,
                    booking_models.Booking.departure_date > arrival_date,
                ),
            )
            .first()
        )
        if overlapping_booking:
            raise HTTPException(
                status_code=400,
                detail=f"Room {room_number} is already booked for the requested dates. Check Booking ID: {overlapping_booking.id}",
            )

        # Calculate the number of days and validate it
        number_of_days = (departure_date - arrival_date).days
        if number_of_days <= 0:
            raise HTTPException(status_code=400, detail="Number of days must be greater than zero.")

        # Determine booking status and cost based on the type
        previous_booking_type = booking.booking_type
        previous_payment_status = booking.payment_status

        if booking_type == "complimentary":
            booking_cost = 0
            payment_status = "complimentary"
            status = "checked-in"
        else:
            booking_cost = room.amount * number_of_days
            # Check if we are transitioning from complimentary to something else
            if previous_booking_type == "complimentary" and previous_payment_status == "complimentary":
                payment_status = "pending"
            else:
                payment_status = booking.payment_status or "pending"

            status = "reserved" if booking_type == "reservation" else "checked-in"

        # Handle attachment update if a new file is provided
        attachment_path = booking.attachment  # default to existing
        if attachment and attachment.filename:
            upload_dir = "uploads/attachments/"
            os.makedirs(upload_dir, exist_ok=True)
            attachment_path = os.path.join(upload_dir, attachment.filename)
            with open(attachment_path, "wb") as buffer:
                shutil.copyfileobj(attachment.file, buffer)
        elif attachment_str:
            # Explicitly use string path from frontend if provided
            attachment_path = attachment_str
        else:
            # If neither file nor string, clear the attachment
            attachment_path = None

        # Update the booking record
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

        # Commit the changes to the database
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
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")





@router.get("/booking/{booking_id}")
def get_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    booking = db.query(booking_models.Booking).filter(booking_models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking with ID {booking_id} not found.")

    return {
        "id": booking.id,
        "room_number": booking.room_number,
        "guest_name": booking.guest_name,
        "gender": booking.gender,
        "mode_of_identification": booking.mode_of_identification,
        "identification_number": booking.identification_number,
        "address": booking.address,
        "arrival_date": booking.arrival_date,
        "departure_date": booking.departure_date,
        "booking_type": booking.booking_type,
        "phone_number": booking.phone_number,
        "vehicle_no": booking.vehicle_no,
        "number_of_days": booking.number_of_days,
        "status": booking.status,
        "room_price": booking.room_price,
        "booking_cost": booking.booking_cost,
        "payment_status": booking.payment_status,
        "attachment": booking.attachment,
        "created_by": booking.created_by,
    }
    
@router.put("/{room_number}/")
def guest_checkout(
    room_number: str,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Endpoint to check out a guest by room number.
    Only allows checkout if the booking is active *today* (i.e., current date is within arrival and departure).
    """
    try:
        today = date.today()

        # Step 1: Check if the room exists
        room = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == room_number.lower()
        ).first()

        if not room:
            raise HTTPException(
                status_code=404,
                detail=f"Room number {room_number} not found."
            )

        # Step 2: Retrieve the booking that is active today
        booking = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == room_number.lower(),
            booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"]),
            booking_models.Booking.arrival_date <= today,
            booking_models.Booking.departure_date >= today
        ).first()

        if not booking:
            raise HTTPException(
                status_code=404,
                detail=f"No active booking found for room {room_number} that is valid for today."
            )

        # Step 3: Update statuses
        booking.status = "checked-out"
        room.status = "available"

        db.commit()
        db.refresh(booking)
        db.refresh(room)

        return {
            "message": f"Guest checked out successfully for room number {room_number}.",
            "room_status": room.status,
            "booking_status": booking.status,
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
    - Includes 'checked-in', 'reserved', or 'complimentary'
    - Includes both current and future bookings (arrival_date >= today)
    """
    today = date.today()

    bookings = db.query(booking_models.Booking).filter(
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
    ).order_by(booking_models.Booking.booking_date.desc()).all()


    formatted = [
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
            "attachment": b.attachment
        }
        for b in bookings
    ]

    return {
        "total_bookings": len(formatted),
        "total_booking_cost": sum(b.booking_cost or 0 for b in bookings),
        "bookings": formatted
    }

   
    
@router.post("/cancel/{booking_id}/")
def cancel_booking(
    booking_id: int,
    cancellation_reason: str = Query(None),
 
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    """
    Cancel a booking if no non-voided payment is tied to it. If a payment exists, raise an exception.
    """
    # Fetch the booking by ID
    booking = db.query(booking_models.Booking).filter(
        booking_models.Booking.id == booking_id, booking_models.Booking.deleted == False
    ).first()

    if not booking:
        raise HTTPException(
            status_code=404,
            detail=f"Booking with ID {booking_id} not found or already canceled."
        )

    # Check if the booking has any associated payments
    payment = db.query(payment_models.Payment).filter(
        payment_models.Payment.booking_id == booking_id
    ).first()

    # If payment exists and is not voided, raise an exception
    if payment and payment.status != "voided":
        raise HTTPException(
            status_code=400,
            detail="Booking is tied to a non-voided payment. Please cancel or delete the payment before canceling the booking."
        )

    # Proceed with cancellation if no valid payment exists or all payments are voided
    try:
        # Update the booking status to 'cancelled'
        booking.status = "cancelled"
        booking.deleted = True  # Mark as soft deleted, indicating cancellation
        booking.cancellation_reason = cancellation_reason  # Store the reason for cancellation

        # Update the room status to 'available'
        room = db.query(room_models.Room).filter(
            room_models.Room.room_number == booking.room_number
        ).first()
        if room:
            room.status = "available"

        db.commit()
        return {
            "message": f"Booking ID {booking_id} has been canceled successfully.",
            "canceled_booking": {
                "id": booking.id,
                "room_number": booking.room_number,
                "guest_name": booking.guest_name,
                "status": booking.status,  # Showing the updated status as 'cancelled'
                "cancellation_reason": booking.cancellation_reason,  # Showing the cancellation reason
                "room_status": room.status if room else "N/A",  # Showing the updated room status
                "created_by": booking.created_by,
            },
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while canceling the booking: {str(e)}"
        )
    

