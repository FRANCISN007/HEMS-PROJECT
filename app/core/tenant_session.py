from sqlalchemy.orm import Session
from sqlalchemy import event
from sqlalchemy.orm import with_loader_criteria

from app.core.tenant import get_current_business
from app.core.mixins import BusinessMixin


@event.listens_for(Session, "do_orm_execute")
def _add_tenant_filter(execute_state):

    if not execute_state.is_select:
        return

    business_id = get_current_business()

    # super admin → no filter
    if business_id is None:
        return

    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            BusinessMixin,
            lambda cls: cls.business_id == business_id,
            include_aliases=True,
        )
    )
