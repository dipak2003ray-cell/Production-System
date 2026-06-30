from decimal import Decimal
from datetime import date
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status

from ..models.process import ProcessMaster
from ..models.rate import RateCard
from ..schemas.process_driver import DriverPayloadSchema
from .driver_validation_service import DriverValidationService

class RateLookupService:
    @staticmethod
    async def resolve_rate_card(
        db: AsyncSession,
        process_id: str,
        payload: DriverPayloadSchema,
        effective_date: Optional[date] = None
    ) -> RateCard:
        """
        Calculates and resolves the exact matching active RateCard based on process driver type constraints, 
        thickness values, alloy subtypes, and effective lookup date.
        """
        # 1. Fetch Process
        proc_res = await db.execute(
            select(ProcessMaster).filter(ProcessMaster.id == process_id, ProcessMaster.is_deleted == False)
        )
        process = proc_res.scalars().first()
        if not process:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Process Master with identifier '{process_id}' does not exist or has been deleted."
            )

        if not process.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Process '{process.name}' is inactive. Cannot perform active billing operations."
            )

        # 2. Validate payload structures
        validation = DriverValidationService.validate_payload(process.driver_type, payload)
        if not validation.is_valid:
            err_details = "; ".join([f"{e.field}: {e.message}" for e in validation.errors])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Driver Validation Failure for process '{process.name}': {err_details}"
            )

        resolved_sub_type = validation.resolved_sub_type
        resolved_thickness = validation.resolved_thickness

        # 3. Handle effective date boundary
        if effective_date is None:
            effective_date = date.today()

        # 4. Construct SQL logic for historical and specification matches
        filters = [
            RateCard.process_id == process_id,
            RateCard.is_active == True,
            RateCard.is_deleted == False,
            RateCard.effective_date <= effective_date
        ]

        # Filter by sub_type if resolved
        if resolved_sub_type is not None:
            filters.append(func.upper(RateCard.sub_type) == resolved_sub_type.upper())
        else:
            filters.append(RateCard.sub_type == None)

        # Execute query to get potential cards
        query = select(RateCard).filter(and_(*filters)).order_by(RateCard.effective_date.desc(), RateCard.created_at.desc())
        cards_res = await db.execute(query)
        candidate_cards = cards_res.scalars().all()

        # 5. Perform thickness range matching in memory or database
        matched_card: Optional[RateCard] = None
        for card in candidate_cards:
            if resolved_thickness is not None:
                # Range check: thickness_from <= resolved_thickness <= thickness_to
                # Ensure null-safe defaults
                t_from = card.thickness_from if card.thickness_from is not None else Decimal("0")
                t_to = card.thickness_to if card.thickness_to is not None else Decimal("999999.9999")
                
                if t_from <= resolved_thickness <= t_to:
                    matched_card = card
                    break
            else:
                # No thickness constraint required
                if card.thickness_from is None and card.thickness_to is None:
                    matched_card = card
                    break

        if not matched_card:
            spec_str = []
            if resolved_sub_type: spec_str.append(f"Sub-type: {resolved_sub_type}")
            if resolved_thickness: spec_str.append(f"Thickness: {resolved_thickness}mm")
            spec_joined = ", ".join(spec_str) or "default metrics"
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"No active Rate Card found for Process '{process.name}' matching specifications "
                    f"[{spec_joined}] active on or before effective date {effective_date}."
                )
            )

        return matched_card
