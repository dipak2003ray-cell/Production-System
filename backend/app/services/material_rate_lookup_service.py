from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.rate import RateCard

class MaterialRateLookupService:
    @classmethod
    async def lookup_rate(
        cls,
        db: AsyncSession,
        material_id: str,
        target_date: date
    ) -> RateCard:
        if isinstance(target_date, str):
            target_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        elif isinstance(target_date, datetime):
            target_date = target_date.date()

        stmt = (
            select(RateCard)
            .where(
                and_(
                    RateCard.material_id == material_id,
                    RateCard.is_active == True,
                    RateCard.is_deleted == False,
                    RateCard.effective_date <= target_date
                )
            )
            .order_by(desc(RateCard.effective_date), desc(RateCard.created_at))
            .limit(1)
        )

        result = await db.execute(stmt)
        rate_card = result.scalars().first()
        return rate_card
