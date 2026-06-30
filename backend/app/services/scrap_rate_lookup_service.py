from datetime import date, datetime
from typing import Optional
from sqlalchemy import select, and_, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.rate import RateCard
from ..models.scrap import ScrapTypeMaster

class ScrapRateLookupService:
    @classmethod
    async def lookup_scrap_rate(
        cls,
        db: AsyncSession,
        scrap_type_input: str,
        target_date: date
    ) -> RateCard:
        """
        Looks up the active RateCard for a given scrap_type (ID or Code) on or before target_date.
        Raises ValueError if scrap type is invalid, inactive, or rate card not found.
        """
        # 1. Resolve scrap type
        stmt_scrap = select(ScrapTypeMaster).where(
            and_(
                or_(
                    ScrapTypeMaster.id == scrap_type_input,
                    ScrapTypeMaster.code == scrap_type_input
                ),
                ScrapTypeMaster.is_deleted == False
            )
        )
        res_scrap = await db.execute(stmt_scrap)
        scrap_type = res_scrap.scalars().first()
        
        if not scrap_type:
            raise ValueError(f"Scrap type '{scrap_type_input}' does not exist or has been deleted.")
            
        if not scrap_type.is_active:
            raise ValueError(f"Scrap type '{scrap_type.code}' is inactive. Cannot perform active billing operations.")

        # 2. Lookup rate card
        stmt_rate = (
            select(RateCard)
            .where(
                and_(
                    RateCard.scrap_id == scrap_type.id,
                    RateCard.is_active == True,
                    RateCard.is_deleted == False,
                    RateCard.effective_date <= target_date
                )
            )
            .order_by(desc(RateCard.effective_date), desc(RateCard.created_at))
            .limit(1)
        )
        
        res_rate = await db.execute(stmt_rate)
        rate_card = res_rate.scalars().first()
        return rate_card
