from typing import Optional
from fastapi import HTTPException


def resolve_business_id(current_user, business_id: Optional[int]) -> int:
    """
    Resolves the correct business_id for the request.

    Rules:
    - Super admin must explicitly provide business_id
    - Business users automatically use their assigned business_id
    """

    roles = [r.strip().lower() for r in current_user.roles] if current_user.roles else []

    # Super admin must provide business_id
    if "super_admin" in roles:
        if business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Super admin must provide business_id"
            )
        return business_id

    # Normal users must have a business
    if not current_user.business_id:
        raise HTTPException(
            status_code=400,
            detail="User not assigned to a business"
        )

    return current_user.business_id
