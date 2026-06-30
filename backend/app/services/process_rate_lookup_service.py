from datetime import date
from typing import Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.rate import RateCard
from ..schemas.process_driver import DriverPayloadSchema
from .rate_lookup_service import RateLookupService

class ProcessRateLookupService:
    @classmethod
    async def lookup_process_rate(
        cls,
        db: AsyncSession,
        process_id: str,
        thickness: Optional[float],
        sub_type: Optional[str],
        effective_date: date
    ) -> RateCard:
        payload = DriverPayloadSchema(
            thickness=Decimal(str(thickness)) if thickness is not None else None,
            sub_type=sub_type
        )
        return await RateLookupService.resolve_rate_card(
            db=db,
            process_id=process_id,
            payload=payload,
            effective_date=effective_date
        )
