from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from sqlalchemy import and_
from sqlalchemy import func
from app.events import models as event_models
from app.events import schemas as event_schemas
from app.users import schemas as user_schemas
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from datetime import datetime, date
import pytz
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder



router = APIRouter()


lagos_tz = pytz.timezone("Africa/Lagos")



@router.post("/", response_model=event_schemas.EventResponse)
def create_event(
    event: event_schemas.EventCreate, 
    db: Session = Depends(get_db), 
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    try:
        # Ensure start and end dates are valid `date` objects
        if not isinstance(event.start_datetime, date) or not isinstance(event.end_datetime, date):
            raise ValueError("Invalid date format.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")

    # Normalize and check for existing event with same date AND location (case-insensitive)
    existing_event = db.query(event_models.Event).filter(
        event_models.Event.start_datetime == event.start_datetime,
        func.lower(event_models.Event.location) == event.location.lower()
    ).first()

    if existing_event:
        raise HTTPException(
            status_code=400,
            detail=f"An event has already been booked on {event.start_datetime} at {event.location}. "
                   f"Please choose a different date or location."
        )

    # Proceed with creating the event
    db_event = event_models.Event(
        organizer=event.organizer,
        title=event.title,
        description=event.description,
        start_datetime=event.start_datetime,
        end_datetime=event.end_datetime,
        event_amount=event.event_amount,
        caution_fee=event.caution_fee,
        location=event.location,
        phone_number=event.phone_number,
        address=event.address,
        payment_status=event.payment_status or "active",
        created_by=current_user.username
    )

    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event



from fastapi.responses import JSONResponse

@router.get("/")
def list_events(
    start_date: str = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(None, description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    query = db.query(event_models.Event).options(joinedload(event_models.Event.payments))

    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(microseconds=1)
            query = query.filter(
                and_(
                    event_models.Event.created_at >= start_dt,
                    event_models.Event.created_at <= end_dt
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    events = query.order_by(event_models.Event.created_at).all()

    for event in events:
        if event.payment_status == "cancelled":
            continue

        # ✅ Total due = event_amount + caution_fee
        total_due = float(event.event_amount or 0) + float(event.caution_fee or 0)

        # ✅ Sum all payments (excluding voided) for this event
        total_paid = sum(
            float(p.amount_paid or 0)
            for p in event.payments
            if p.payment_status != "voided"
        )
        total_discount = sum(
            float(p.discount_allowed or 0)
            for p in event.payments
            if p.payment_status != "voided"
        )

        balance_due = total_due - (total_paid + total_discount)

        # ✅ Recompute payment status dynamically
        if balance_due > 0:
            event.payment_status = "incomplete"
        elif balance_due == 0:
            event.payment_status = "complete"
        else:
            event.payment_status = "excess"

    # Compute summary
    filtered_events = [e for e in events if e.payment_status != "cancelled"]
    total_amount = sum(e.event_amount or 0 for e in filtered_events)

    summary = {
        "total_entries": len(events),
        "total_booking_amount": total_amount
    }

    return JSONResponse(content={
        "events": jsonable_encoder(events),
        "summary": summary
    })




# Get Event by ID
@router.get("/{event_id}", response_model=event_schemas.EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db),
              current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
              ):
    db_event = db.query(event_models.Event).filter(event_models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    return db_event


# Update Event (Only Creator or Admin)
@router.put("/{event_id}", response_model=dict)
def update_event(
    event_id: int,
    event: event_schemas.EventCreate, 
    db: Session = Depends(get_db), 
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    db_event = db.query(event_models.Event).filter(event_models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    if db_event.created_by != current_user.username and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only event creators or admins can update events")

    for field, value in event.dict(exclude_unset=True).items():
        setattr(db_event, field, value)

    db.commit()
    db.refresh(db_event)

    return {"message": "Event updated successfully"}


@router.put("/{event_id}/cancel", response_model=dict)
def cancel_event(
    event_id: int, 
    cancellation_reason: str,
    db: Session = Depends(get_db), 
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["event"]))
):
    #if current_user.role != "admin":
        #raise HTTPException(status_code=403, detail="Only admins can cancel events")

    # Fetch the event by ID
    db_event = db.query(event_models.Event).filter(event_models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Update the payment status and cancellation reason
    db_event.payment_status = "cancelled"
    db_event.cancellation_reason = cancellation_reason  # Store reason in the column

    try:
        # Commit changes to the database
        db.commit()

        # Explicitly refresh the session to ensure changes are reflected
        db.refresh(db_event)

        # Re-fetch the event to ensure payment_status is updated
        updated_event = db.query(event_models.Event).filter(event_models.Event.id == event_id).first()

        if not updated_event:
            raise HTTPException(status_code=404, detail="Event not found after cancellation")

        return {
            "message": "Event cancellation successful",
            "cancellation_reason": updated_event.cancellation_reason,
            "payment_status": updated_event.payment_status,  # Return the updated payment status
        }

    except Exception as e:
        db.rollback()  # Rollback the transaction in case of any error
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
