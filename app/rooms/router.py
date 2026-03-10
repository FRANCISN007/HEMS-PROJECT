from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from sqlalchemy.sql import func
from sqlalchemy import and_, or_, not_
from app.rooms import schemas as room_schemas, models as room_models, crud
from app.bookings import models as booking_models  # Adjust path if needed
from app.payments import models as payment_models
from app.users import schemas as user_schemas
from app.rooms import schemas

from sqlalchemy import func
from datetime import datetime, time, date
from sqlalchemy import desc

import re
from typing import Optional
from fastapi import Query
from sqlalchemy import select, not_



from typing import List


from app.rooms.models import RoomFault  # Not app.models.room
from app.rooms.schemas import RoomFaultOut , RoomStatusUpdate # Not app.schemas.room
from app.rooms.schemas import FaultUpdate
from .schemas import RoomOut  # import the new output schema


from datetime import date
from loguru import logger
import os



from sqlalchemy.sql import func




router = APIRouter()


from datetime import datetime
from zoneinfo import ZoneInfo
def get_local_time():
    return datetime.now(ZoneInfo("Africa/Lagos"))


# Set up logging
logger.add("app.log", rotation="500 MB", level="DEBUG")


#log_path = os.path.join(os.getenv("LOCALAPPDATA", "C:\\Temp"), "app.log")
#logger.add("C:/Users/KLOUNGE/Documents/app.log", rotation="500 MB", level="DEBUG")




@router.post("/", response_model=dict)
def create_room(
    room: schemas.RoomSchema,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    logger.info(
        f"Room creation request received. User: {current_user.username}, Roles: {current_user.roles}"
    )

    roles = set(current_user.roles)

    # ---------------- Determine Business ----------------
    if "super_admin" in roles:
        if not room.business_id:
            raise HTTPException(
                status_code=400,
                detail="business_id is required for super admin"
            )
        business_id = room.business_id
    else:
        if "admin" not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        business_id = current_user.business_id

    original_room_number = room.room_number
    normalized_room_number = original_room_number.lower()

    # ---------------- Room uniqueness per business ----------------
    existing_room = (
        db.query(room_models.Room)
        .filter(
            func.lower(room_models.Room.room_number) == normalized_room_number,
            room_models.Room.business_id == business_id
        )
        .first()
    )

    if existing_room:
        raise HTTPException(
            status_code=400,
            detail="Room with this number already exists for this business"
        )

    try:
        new_room = crud.create_room(db, room, business_id)

        return {
            "message": "Room created successfully",
            "room": schemas.RoomOut.model_validate(new_room)
        }

    except Exception as e:
        logger.exception(f"Error creating room {original_room_number}")
        raise HTTPException(
            status_code=500,
            detail=str(e)   # show the real error
        )







from datetime import date
from typing import Optional
from fastapi import Query
from app.rooms import crud  # assuming your crud.py is under app.rooms

@router.get("/", response_model=dict)
def list_rooms(
    skip: int = 0,
    limit: int = 50,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    today = date.today()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" in roles:
        # super_admin can optionally filter by query param
        # if business_id is None, it lists all businesses
        pass
    else:
        # normal admin/other roles always use their own business_id
        business_id = current_user.business_id

    # ---------------- Fetch rooms using SaaS-ready helper ----------------
    rooms = crud.get_rooms_with_pagination(skip=skip, limit=limit, db=db, business_id=business_id)
    room_numbers = [room.room_number for room in rooms]

    # ---------------- Fetch relevant bookings ----------------
    booking_query = db.query(
        booking_models.Booking.room_number,
        booking_models.Booking.arrival_date,
        booking_models.Booking.departure_date,
        booking_models.Booking.status
    ).filter(
        booking_models.Booking.room_number.in_(room_numbers),
        booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"])
    )

    if business_id:
        booking_query = booking_query.filter(booking_models.Booking.business_id == business_id)

    active_bookings = booking_query.all()

    # ---------------- Collect future reservations ----------------
    reservation_bookings = [
        b for b in active_bookings if b.status == "reserved" and b.arrival_date >= today
    ]

    # ---------------- Annotate future reservation counts for serialization ----------------
    for room in rooms:
        room.future_reservation_count = sum(
            1 for r in reservation_bookings if r.room_number == room.room_number
        )

        # Compute final status without changing existing logic
        final_status = "available"
        relevant = [b for b in active_bookings if b.room_number == room.room_number]

        if room.status == "maintenance":
            final_status = "maintenance"
        else:
            for booking in relevant:
                if booking.status == "complimentary" and booking.arrival_date <= today <= booking.departure_date:
                    final_status = "complimentary"
                    break
                elif booking.status == "checked-in" and booking.arrival_date <= today <= booking.departure_date:
                    final_status = "checked-in"
                    break
                elif booking.status == "reserved" and booking.arrival_date >= today:
                    final_status = "reserved"

        room.status = final_status

    # ---------------- Serialize rooms ----------------
    serialized_rooms = crud.serialize_rooms(rooms)

    # ---------------- Total rooms ----------------
    total_query = db.query(room_models.Room)
    if business_id:
        total_query = total_query.filter(room_models.Room.business_id == business_id)
    total_rooms = total_query.count()

    return {
        "total_rooms": total_rooms,
        "rooms": serialized_rooms,
    }



from datetime import datetime, date, time
from typing import Optional
from fastapi import Query

@router.post("/update_status_after_checkout")
def update_rooms_after_checkout(
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    now = datetime.now()
    today = date.today()
    noon = time(12, 0)

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" in roles:
        # super_admin can optionally filter by query param
        # if business_id is None, update all businesses
        pass
    else:
        # normal admin/other roles always use their own business_id
        business_id = current_user.business_id

    # ---------------- Get bookings departing today ----------------
    bookings_query = db.query(booking_models.Booking).filter(
        booking_models.Booking.departure_date == today,
        booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"])
    )

    if business_id:
        bookings_query = bookings_query.filter(booking_models.Booking.business_id == business_id)

    bookings = bookings_query.all()

    updated_rooms = []
    updated_bookings = []

    # Only update after 12 noon
    if now.time() >= noon:
        for booking in bookings:
            # Check if there is another overlapping active booking for this room
            overlapping_query = db.query(booking_models.Booking).filter(
                booking_models.Booking.room_number == booking.room_number,
                booking_models.Booking.id != booking.id,
                booking_models.Booking.status.in_(["checked-in", "reserved", "complimentary"]),
                booking_models.Booking.arrival_date <= today,
                booking_models.Booking.departure_date >= today
            )
            if business_id:
                overlapping_query = overlapping_query.filter(booking_models.Booking.business_id == business_id)

            overlapping = overlapping_query.first()

            if overlapping:
                continue  # Skip this booking and don't change room status

            # Mark the booking as checked-out
            booking.status = "checked-out"
            updated_bookings.append(booking.id)

            # Update room status if not in maintenance
            room_query = db.query(room_models.Room).filter_by(room_number=booking.room_number)
            if business_id:
                room_query = room_query.filter(room_models.Room.business_id == business_id)
            room = room_query.first()

            if room and room.status != "maintenance":
                room.status = "available"
                updated_rooms.append(room.room_number)

        db.commit()

    return {
        "message": "Room and booking statuses updated after 12 noon checkout time",
        "rooms_updated": updated_rooms,
        "bookings_updated": updated_bookings,
    }





@router.get("/available")
def list_available_rooms(
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    today = date.today()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" in roles:
        # super_admin can optionally filter by query param
        pass
    else:
        # normal admin/other roles always use their own business_id
        business_id = current_user.business_id

    # ---------------- Step 1: Get rooms not booked as reserved or checked-in ----------------
    bookings_query = db.query(booking_models.Booking.room_number).filter(
        booking_models.Booking.status.in_(["reserved", "checked-in"]),
        booking_models.Booking.arrival_date <= today,
        booking_models.Booking.departure_date >= today,
    )

    if business_id:
        bookings_query = bookings_query.filter(booking_models.Booking.business_id == business_id)

    unavailable_room_numbers = bookings_query.subquery()

    # FIX: Wrap subquery using select()
    available_rooms_query = db.query(room_models.Room).filter(
        not_(room_models.Room.room_number.in_(select(unavailable_room_numbers.c.room_number)))
    )

    if business_id:
        available_rooms_query = available_rooms_query.filter(room_models.Room.business_id == business_id)

    all_available_rooms = available_rooms_query.all()

    total_rooms_query = db.query(room_models.Room)
    if business_id:
        total_rooms_query = total_rooms_query.filter(room_models.Room.business_id == business_id)
    total_rooms = total_rooms_query.count()

    if not all_available_rooms:
        return {
            "message": "We are fully booked! No rooms are available for today.",
            "total_rooms": total_rooms,
            "total_available_rooms": 0,
            "available_rooms": [],
        }

    # ---------------- Step 2: Prepare data for frontend ----------------
    serialized_rooms = []
    available_count = 0  # Count excludes maintenance rooms

    for room in all_available_rooms:
        serialized_rooms.append({
            "room_number": room.room_number,
            "room_type": room.room_type,
            "amount": room.amount,
            "status": room.status
        })

        if room.status != "maintenance":
            available_count += 1

    # ---------------- Natural ascending sort ----------------
    def natural_sort_key(room):
        return [int(part) if part.isdigit() else part.lower()
                for part in re.split(r'(\d+)', room["room_number"])]

    available_sorted = sorted(
        [r for r in serialized_rooms if r["status"] != "maintenance"],
        key=natural_sort_key
    )
    maintenance_sorted = sorted(
        [r for r in serialized_rooms if r["status"] == "maintenance"],
        key=natural_sort_key
    )

    return {
        "message": "Available rooms fetched successfully.",
        "total_rooms": total_rooms,
        "total_available_rooms": available_count,
        "available_rooms": available_sorted + maintenance_sorted,
    }





@router.get("/unavailable", response_model=dict)
def list_unavailable_rooms(
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Return rooms that are currently unavailable based on bookings today,
    but only if the booking has at least one payment or is complimentary.
    """
    today = date.today()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" in roles:
        # super_admin can optionally filter by query param
        pass
    else:
        # normal admin/other roles always use their own business_id
        business_id = current_user.business_id

    # ---------------- Subquery to check for valid payments ----------------
    has_payment = db.query(payment_models.Payment).filter(
        payment_models.Payment.booking_id == booking_models.Booking.id,
        payment_models.Payment.void_date.is_(None)
    ).exists()

    # ---------------- Query active bookings with payment or complimentary ----------------
    bookings_query = db.query(booking_models.Booking).filter(
        booking_models.Booking.arrival_date <= today,
        booking_models.Booking.departure_date >= today,
        booking_models.Booking.status.in_(["checked-in", "complimentary", "reserved"]),
        or_(
            has_payment,
            booking_models.Booking.payment_status == "complimentary"
        )
    )

    if business_id:
        bookings_query = bookings_query.filter(booking_models.Booking.business_id == business_id)

    active_bookings = bookings_query.all()

    # ---------------- Build unavailable rooms ----------------
    unavailable_rooms = []
    total_booking_cost = 0

    for booking in active_bookings:
        number_of_days = (booking.departure_date - booking.arrival_date).days or 1

        unavailable_rooms.append({
            "booking_id": booking.id,
            "room_number": booking.room_number,
            "guest_name": booking.guest_name,
            "arrival_date": booking.arrival_date,
            "departure_date": booking.departure_date,
            "number_of_days": number_of_days,
            "booking_date": booking.booking_date,
            "booking_type": booking.booking_type,
            "status": booking.status,
            "payment_status": booking.payment_status,
            "phone_number": booking.phone_number,
            "booking_cost": booking.booking_cost,
            "created_by": booking.created_by,
            "attachment": f"http://localhost:8000/static/attachments/{booking.attachment}" if booking.attachment else None
        })

        total_booking_cost += booking.booking_cost or 0

    # ---------------- Natural sort for room numbers ----------------
    def natural_sort_key(room):
        return [int(text) if text.isdigit() else text.lower()
                for text in re.split(r'(\d+)', room["room_number"])]

    unavailable_rooms = sorted(unavailable_rooms, key=natural_sort_key)

    return {
        "message": "Unavailable rooms fetched successfully.",
        "total_unavailable": len(unavailable_rooms),
        "total_booking_cost": total_booking_cost,
        "unavailable_rooms": unavailable_rooms,
    }




from typing import List, Optional
from fastapi import Query

@router.put("/faults/update")
def update_faults(
    faults: List[FaultUpdate],
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" in roles:
        # super_admin can optionally filter by query param
        pass
    else:
        # normal admin/other roles always use their own business_id
        business_id = current_user.business_id

    affected_rooms = set()

    for fault in faults:
        db_fault_query = db.query(RoomFault).filter(RoomFault.id == fault.id)
        if business_id:
            db_fault_query = db_fault_query.filter(RoomFault.business_id == business_id)
        db_fault = db_fault_query.first()

        if db_fault:
            if db_fault.resolved != fault.resolved:
                db_fault.resolved = fault.resolved
                db_fault.resolved_at = get_local_time() if fault.resolved else None
            affected_rooms.add(db_fault.room_number)

    db.commit()

    # ---------------- Re-check all faults for affected rooms ----------------
    for room_number in affected_rooms:
        unresolved_query = db.query(RoomFault).filter(
            RoomFault.room_number == room_number,
            RoomFault.resolved == False
        )
        if business_id:
            unresolved_query = unresolved_query.filter(RoomFault.business_id == business_id)
        unresolved = unresolved_query.first()

        room_query = db.query(room_models.Room).filter(
            room_models.Room.room_number == room_number
        )
        if business_id:
            room_query = room_query.filter(room_models.Room.business_id == business_id)
        room = room_query.first()

        if room and not unresolved and room.status == "maintenance":
            room.status = "available"

    db.commit()

    return {"message": "Faults updated successfully"}




from fastapi import Query

@router.patch("/faults/{fault_id}")
def update_fault_status(
    fault_id: int,
    update: FaultUpdate,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" not in roles:
        business_id = current_user.business_id  # normal admin can only update their business

    # ---------------- Fetch fault ----------------
    fault_query = db.query(RoomFault).filter(RoomFault.id == fault_id)
    if business_id:
        fault_query = fault_query.filter(RoomFault.business_id == business_id)
    fault = fault_query.first()

    if not fault:
        raise HTTPException(status_code=404, detail="Fault not found")

    # ---------------- Permission check ----------------
    if fault.resolved and not update.resolved:
        if "admin" not in roles:
            raise HTTPException(
                status_code=403,
                detail="Only an admin can mark a resolved fault as unresolved."
            )

    # ---------------- Update fault ----------------
    fault.resolved = update.resolved
    fault.resolved_at = get_local_time() if update.resolved else None

    db.commit()
    db.refresh(fault)

    return {
        "id": fault.id,
        "room_number": fault.room_number,
        "description": fault.description,
        "resolved": fault.resolved,
        "created_at": fault.created_at.strftime('%Y-%m-%d %H:%M') if fault.created_at else None,
        "resolved_at": fault.resolved_at.strftime('%Y-%m-%d %H:%M') if fault.resolved_at else None
    }





@router.get("/{room_number}/faults", response_model=List[RoomFaultOut])
def get_room_faults(
    room_number: str,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    room_number = room_number.lower()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" not in roles:
        business_id = current_user.business_id  # normal admin can only view their business

    # ---------------- Fetch unresolved faults ----------------
    unresolved_query = db.query(RoomFault).filter(
        func.lower(RoomFault.room_number) == room_number,
        RoomFault.resolved == False
    ).order_by(desc(RoomFault.created_at))
    if business_id:
        unresolved_query = unresolved_query.filter(RoomFault.business_id == business_id)
    unresolved_faults = unresolved_query.all()

    # ---------------- Fetch resolved faults ----------------
    resolved_query = db.query(RoomFault).filter(
        func.lower(RoomFault.room_number) == room_number,
        RoomFault.resolved == True
    ).order_by(desc(RoomFault.resolved_at))
    if business_id:
        resolved_query = resolved_query.filter(RoomFault.business_id == business_id)
    resolved_faults = resolved_query.all()

    combined_faults = unresolved_faults + resolved_faults

    # ---------------- Serialize ----------------
    return [
        {
            "id": f.id,
            "room_number": f.room_number,
            "description": f.description,
            "resolved": f.resolved,
            "created_at": f.created_at.strftime('%Y-%m-%d %H:%M') if f.created_at else None,
            "resolved_at": f.resolved_at.strftime('%Y-%m-%d %H:%M') if f.resolved_at else None
        }
        for f in combined_faults
    ]





@router.put("/{room_number}/status")
def update_room_status(
    room_number: str,
    status_update: RoomStatusUpdate,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    room_number_clean = room_number.strip().lower()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" not in roles:
        business_id = current_user.business_id  # normal admin can only update their business

    # ---------------- Fetch room ----------------
    room_query = db.query(room_models.Room).filter(func.lower(room_models.Room.room_number) == room_number_clean)
    if business_id:
        room_query = room_query.filter(room_models.Room.business_id == business_id)

    room = room_query.first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # ---------------- Update status ----------------
    room.status = status_update.status
    db.commit()

    return {"message": f"Room {room_number} status updated to {status_update.status}"}



from typing import Optional
from fastapi import Query

@router.put("/{room_number}")
def update_room(
    room_number: str,
    room_update: room_schemas.RoomUpdateSchema,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    room_number_clean = room_number.lower()

    # ---------------- Determine business ----------------
    roles = set(current_user.roles)
    if "super_admin" not in roles:
        business_id = current_user.business_id  # normal admin can only update their business

    # ---------------- Fetch room ----------------
    room_query = db.query(room_models.Room).filter(func.lower(room_models.Room.room_number) == room_number_clean)
    if business_id:
        room_query = room_query.filter(room_models.Room.business_id == business_id)
    room = room_query.first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.status == "checked-in":
        raise HTTPException(status_code=400, detail="Room cannot be updated as it is currently checked-in")

    # ---------------- Update basic fields ----------------
    if room_update.room_number and room_update.room_number.lower() != room.room_number.lower():
        existing_room_query = db.query(room_models.Room).filter(func.lower(room_models.Room.room_number) == room_update.room_number.lower())
        if business_id:
            existing_room_query = existing_room_query.filter(room_models.Room.business_id == business_id)
        existing_room = existing_room_query.first()
        if existing_room:
            raise HTTPException(status_code=400, detail="Room with this number already exists")
        room.room_number = room_update.room_number.lower()

    if room_update.room_type:
        room.room_type = room_update.room_type

    if room_update.amount is not None:
        room.amount = room_update.amount

    if room_update.status:
        if room_update.status not in ["available", "maintenance"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
        room.status = room_update.status

    # ---------------- Process faults ----------------
    if room_update.faults is not None:
        for fault_data in room_update.faults:
            if fault_data.id is not None:
                existing_fault_query = db.query(room_models.RoomFault).filter(
                    room_models.RoomFault.id == fault_data.id,
                    room_models.RoomFault.room_number == room.room_number
                )
                if business_id:
                    existing_fault_query = existing_fault_query.filter(room_models.RoomFault.business_id == business_id)
                existing_fault = existing_fault_query.first()
                if existing_fault:
                    existing_fault.resolved = fault_data.resolved
                    existing_fault.description = fault_data.description
            else:
                new_fault = room_models.RoomFault(
                    room_number=room.room_number,
                    description=fault_data.description,
                    resolved=fault_data.resolved if fault_data.resolved is not None else False,
                    business_id=business_id
                )
                db.add(new_fault)

    db.commit()

    # ---------------- Re-check all faults ----------------
    unresolved_faults_query = db.query(room_models.RoomFault).filter(
        room_models.RoomFault.room_number == room.room_number,
        room_models.RoomFault.resolved == False
    )
    if business_id:
        unresolved_faults_query = unresolved_faults_query.filter(room_models.RoomFault.business_id == business_id)
    unresolved_faults = unresolved_faults_query.all()

    if not unresolved_faults:
        room.status = "available"

    db.commit



@router.get("/{room_number}")
def get_room(
    room_number: str,
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    logger.info(f"Fetching room with room_number: {room_number}")

    try:
        if not room_number:
            logger.warning("Room number is missing in the request")
            raise HTTPException(status_code=400, detail="Room number is required")

        # ---------------- Determine business ----------------
        roles = set(current_user.roles)
        if "super_admin" not in roles:
            business_id = current_user.business_id  # normal admin can only view their business

        # ---------------- Normalize input ----------------
        normalized_room_number = room_number.strip().lower()
        logger.debug(f"Normalized room number: {normalized_room_number}")

        # ---------------- Query the room ----------------
        room_query = db.query(room_models.Room).filter(
            func.lower(room_models.Room.room_number) == normalized_room_number
        )
        if business_id:
            room_query = room_query.filter(room_models.Room.business_id == business_id)

        room = room_query.first()
        if not room:
            logger.warning(f"Room {room_number} not found.")
            raise HTTPException(status_code=404, detail="Room not found")

        # ---------------- Fetch latest active booking ----------------
        booking_query = db.query(booking_models.Booking).filter(
            func.lower(booking_models.Booking.room_number) == normalized_room_number,
            booking_models.Booking.status.notin_(["checked-out", "cancelled"])
        )
        if business_id:
            booking_query = booking_query.filter(booking_models.Booking.business_id == business_id)

        latest_booking = booking_query.order_by(booking_models.Booking.booking_date.desc()).first()
        booking_type = latest_booking.booking_type if latest_booking else "No active booking"

        logger.info(f"Successfully fetched room: {room.room_number}, Booking Type: {booking_type}")

        return {
            "room_number": room.room_number,
            "room_type": room.room_type,
            "amount": room.amount,
            "status": room.status,
            "booking_type": booking_type
        }

    except HTTPException as http_err:
        raise http_err  # Re-raise known HTTP exceptions

    except Exception as e:
        logger.error(f"Unexpected error fetching room {room_number}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal server error occurred")




from typing import Optional
from fastapi import Query, HTTPException, Depends
from sqlalchemy import or_, and_, func
from datetime import date
from sqlalchemy.orm import Session

@router.get("/summary")
def room_summary(
    business_id: Optional[int] = Query(None, description="Super admin only: filter by business_id"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Generate a summary of all rooms, including counts of:
    - Checked-in rooms (today)
    - Reserved rooms (future)
    - Available rooms for today
    """
    today = date.today()

    try:
        # ---------------- Determine business ----------------
        roles = set(r.lower() for r in (current_user.roles or []))
        if "super_admin" in roles:
            # super admin can filter by query param or see all businesses if None
            business_filter = business_id
        else:
            # normal users always see their own business
            business_filter = current_user.business_id

        # ---------------- Total rooms ----------------
        total_rooms_query = db.query(room_models.Room)
        if business_filter:
            total_rooms_query = total_rooms_query.filter(room_models.Room.business_id == business_filter)
        total_rooms = total_rooms_query.count()

        # ---------------- Checked-in rooms today ----------------
        checked_in_query = db.query(booking_models.Booking)
        checked_in_query = checked_in_query.filter(
            booking_models.Booking.status == "checked-in",
            booking_models.Booking.arrival_date <= today,
            booking_models.Booking.departure_date >= today
        )
        if business_filter:
            checked_in_query = checked_in_query.filter(booking_models.Booking.business_id == business_filter)
        total_checked_in_rooms = checked_in_query.count()

        # ---------------- Reserved rooms (future) ----------------
        reserved_query = db.query(booking_models.Booking)
        reserved_query = reserved_query.filter(
            booking_models.Booking.status == "reserved",
            booking_models.Booking.arrival_date >= today
        )
        if business_filter:
            reserved_query = reserved_query.filter(booking_models.Booking.business_id == business_filter)
        total_reserved_rooms = reserved_query.count()

        # ---------------- Occupied rooms today ----------------
        occupied_query = db.query(booking_models.Booking.room_number).filter(
            or_(
                booking_models.Booking.status == "checked-in",
                and_(
                    booking_models.Booking.status == "reserved",
                    booking_models.Booking.arrival_date <= today,
                    booking_models.Booking.departure_date >= today
                )
            )
        )
        if business_filter:
            occupied_query = occupied_query.filter(booking_models.Booking.business_id == business_filter)

        occupied_room_numbers_today = {r.room_number for r in occupied_query.distinct().all()}

        # ---------------- Total available rooms ----------------
        total_available_rooms = max(total_rooms - len(occupied_room_numbers_today), 0)

        message = (
            f"{total_available_rooms} room(s) available."
            if total_available_rooms > 0
            else "Fully booked! All rooms are occupied for today."
        )

        return {
            "total_rooms": total_rooms,
            "rooms_checked_in": total_checked_in_rooms,
            "rooms_reserved": total_reserved_rooms,
            "rooms_available": total_available_rooms,
            "message": message,
        }

    except Exception as e:
        logger.error(f"Error generating room summary: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching room summary"
        )



from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

@router.delete("/{room_number}")
def delete_room(
    room_number: str,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["dashboard"]))
):
    """
    Delete a room by its room_number.
    Only users with 'admin' role can delete rooms.
    Prevent deletion if room has any existing bookings.
    """
    # ---------------- Permission check ----------------
    roles = set(r.lower() for r in (current_user.roles or []))
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # ---------------- Normalize input ----------------
    room_number_norm = room_number.strip().lower()

    # ---------------- Fetch room ----------------
    room = db.query(room_models.Room).filter(
        func.lower(room_models.Room.room_number) == room_number_norm
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_number}' not found")

    # ---------------- Check for linked bookings ----------------
    has_bookings = db.query(booking_models.Booking).filter(
        func.lower(booking_models.Booking.room_number) == room_number_norm
    ).first()
    if has_bookings:
        raise HTTPException(
            status_code=400,
            detail=f"Room '{room_number}' cannot be deleted because it is tied to existing bookings"
        )

    # ---------------- Delete the room ----------------
    try:
        db.delete(room)
        db.commit()
        return {"message": f"Room '{room_number}' deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while deleting the room: {str(e)}"
        )
