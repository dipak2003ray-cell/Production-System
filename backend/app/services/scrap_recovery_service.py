import json
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.scrap import ScrapTypeMaster
from .scrap_rate_lookup_service import ScrapRateLookupService
from ..schemas.scrap_recovery import ScrapCalculateRequest, ScrapCalculateResponse

class ScrapRecoveryService:
    @classmethod
    async def calculate_scrap_recovery(
        cls,
        db: AsyncSession,
        req: ScrapCalculateRequest
    ) -> ScrapCalculateResponse:
        """
        Main calculation handler for Scrap Recovery Engine.
        """
        # 1. Resolve effective date
        target_date_str = req.effective_date or date.today().isoformat()
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid effective_date format: '{target_date_str}'. Expected YYYY-MM-DD.")

        # 2. Resolve Scrap Type Master to make sure it exists, is active, and is not deleted
        stmt_scrap = select(ScrapTypeMaster).where(
            and_(
                or_(
                    ScrapTypeMaster.id == req.scrap_type,
                    ScrapTypeMaster.code == req.scrap_type
                ),
                ScrapTypeMaster.is_deleted == False
            )
        )
        res_scrap = await db.execute(stmt_scrap)
        scrap_type = res_scrap.scalars().first()
        if not scrap_type:
            raise ValueError(f"Scrap type '{req.scrap_type}' does not exist or has been deleted.")

        if not scrap_type.is_active:
            raise ValueError(f"Scrap type '{scrap_type.code}' is inactive. Cannot perform active billing operations.")

        # 3. Lookup Rate Card
        rate_card = await ScrapRateLookupService.lookup_scrap_rate(db, scrap_type.id, target_date)
        if not rate_card:
            raise ValueError(f"No active scrap rate on record for scrap type '{scrap_type.code}' on or before effective date {target_date_str}.")

        # 4. Perform credit calculation
        scrap_qty_dec = Decimal(str(req.scrap_quantity))
        if scrap_qty_dec < Decimal("0.0"):
            raise ValueError("Scrap quantity cannot be negative.")

        rate_dec = Decimal(str(rate_card.rate))
        recovery_credit_dec = scrap_qty_dec * rate_dec

        # 5. Build Audit Trail / Traceability log
        formula_used = "Scrap Quantity × Scrap Rate"
        explanation = f"Calculated recovery credit for scrap type '{scrap_type.code}' using {scrap_qty_dec} {rate_card.rate_unit} at standard rate of ₹{rate_dec}/{rate_card.rate_unit}."

        audit_trail = {
            "bom_line_id": req.bom_line_id,
            "material_id": req.material_id,
            "scrap_type_id": scrap_type.id,
            "scrap_type_code": scrap_type.code,
            "scrap_type_name": scrap_type.name,
            "scrap_rate_id": rate_card.id,
            "rate_card_id": rate_card.id,
            "effective_date_used": target_date.isoformat(),
            "scrap_quantity": float(scrap_qty_dec),
            "recovery_credit": float(recovery_credit_dec),
            "formula_used": formula_used,
            "rate_used": float(rate_dec),
            "explanation": explanation
        }

        return ScrapCalculateResponse(
            bom_line_id=req.bom_line_id,
            material_id=req.material_id,
            scrap_type_id=scrap_type.id,
            scrap_type_code=scrap_type.code,
            scrap_type_name=scrap_type.name,
            rate_card_id=rate_card.id,
            rate=float(rate_dec),
            rate_unit=rate_card.rate_unit,
            scrap_quantity=float(scrap_qty_dec),
            recovery_credit=float(recovery_credit_dec),
            effective_date_used=target_date.isoformat(),
            formula_used=formula_used,
            calculation_explanation=explanation,
            audit_trail_json=json.dumps(audit_trail)
        )
