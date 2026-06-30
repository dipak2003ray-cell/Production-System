from decimal import Decimal
from datetime import date, datetime
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.material import MaterialMaster
from .uom_conversion_service import UOMConversionService
from .material_rate_lookup_service import MaterialRateLookupService
from ..schemas.material_cost import MaterialCalculateRequest, MaterialCalculateResponse

class MaterialCostService:
    @classmethod
    async def calculate_line_cost(
        cls,
        db: AsyncSession,
        req: MaterialCalculateRequest
    ) -> MaterialCalculateResponse:
        # 1. Fetch material master
        stmt = select(MaterialMaster).where(MaterialMaster.id == req.material_id)
        result = await db.execute(stmt)
        material = result.scalars().first()
        if not material or material.is_deleted:
            raise ValueError(f"Material with ID '{req.material_id}' was not found or is deleted.")

        # 2. Parse target date
        target_date_str = req.effective_date or date.today().isoformat()
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid effective_date format: '{target_date_str}'. Expected YYYY-MM-DD.")

        # 3. Lookup standard rate card
        rate_card = await MaterialRateLookupService.lookup_rate(db, req.material_id, target_date)
        if not rate_card:
            raise ValueError(f"No active rate card on record for material code '{material.code}' on or before effective date {target_date_str}.")

        # 4. Resolve Quantity & UOM conversion
        qty_dec = Decimal(str(req.quantity))
        from_uom = req.uom
        to_uom = material.std_unit

        conversion_ratio = Decimal("1.0")
        try:
            converted_qty_dec = UOMConversionService.convert(qty_dec, from_uom, to_uom)
            if from_uom.strip().upper() != to_uom.strip().upper():
                conversion_applied = f"{qty_dec} {from_uom} -> {converted_qty_dec} {to_uom}"
                if qty_dec != 0:
                    conversion_ratio = converted_qty_dec / qty_dec
            else:
                conversion_applied = "None"
        except ValueError as e:
            raise ValueError(f"UOM Failure: {str(e)}")

        # 5. Waste modifiers
        waste_modifier_dec = Decimal(str(req.waste_modifier))
        effective_qty_dec = converted_qty_dec * waste_modifier_dec
        waste_qty_dec = effective_qty_dec - converted_qty_dec

        # 6. Rate calculation
        rate_val_dec = Decimal(str(rate_card.rate))
        subtotal_dec = effective_qty_dec * rate_val_dec

        # 7. Traceability audit trails
        audit_trail = {
            "bom_line_id": req.bom_line_id,
            "material_id": req.material_id,
            "material_code": material.code,
            "rate_card_id": rate_card.id,
            "effective_date_used": target_date.isoformat(),
            "conversion_ratio": float(conversion_ratio),
            "conversion_applied": conversion_applied,
            "waste_factor_applied": float(waste_modifier_dec),
            "original_quantity": float(qty_dec),
            "original_uom": from_uom,
            "resolved_quantity": float(converted_qty_dec),
            "resolved_uom": to_uom,
            "effective_quantity": float(effective_qty_dec),
            "rate_used": float(rate_val_dec),
            "calculated_subtotal": float(subtotal_dec),
            "explanation": f"Converted {qty_dec} {from_uom} to {converted_qty_dec} {to_uom}. Applied waste factor {waste_modifier_dec} to get {effective_qty_dec} {to_uom}. Multiplied with rate Rs.{rate_val_dec}/{rate_card.rate_unit}."
        }

        return MaterialCalculateResponse(
            bom_line_id=req.bom_line_id,
            material_id=req.material_id,
            material_code=material.code,
            rate_card_id=rate_card.id,
            rate=float(rate_val_dec),
            rate_unit=rate_card.rate_unit,
            original_quantity=float(qty_dec),
            original_uom=from_uom,
            resolved_quantity=float(converted_qty_dec),
            resolved_uom=to_uom,
            waste_modifier=float(waste_modifier_dec),
            waste_quantity=float(waste_qty_dec),
            effective_quantity=float(effective_qty_dec),
            material_subtotal=float(subtotal_dec),
            effective_date_used=target_date.isoformat(),
            conversion_applied=conversion_applied,
            waste_factor_applied=float(waste_modifier_dec),
            calculation_explanation=audit_trail["explanation"],
            audit_trail_json=json.dumps(audit_trail)
        )
