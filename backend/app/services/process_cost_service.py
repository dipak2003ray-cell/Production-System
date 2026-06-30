import json
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.process import ProcessMaster
from ..models.rate import RateCard
from ..schemas.process_driver import DriverPayloadSchema
from ..schemas.process_cost import ProcessCalculateRequest, ProcessCalculateResponse
from .process_rate_lookup_service import ProcessRateLookupService
from .driver_validation_service import DriverValidationService

class ProcessCostService:
    @classmethod
    async def calculate_line_cost(
        cls,
        db: AsyncSession,
        req: ProcessCalculateRequest
    ) -> ProcessCalculateResponse:
        # 1. Fetch Process Master
        stmt = select(ProcessMaster).where(ProcessMaster.id == req.process_id)
        result = await db.execute(stmt)
        process = result.scalars().first()
        if not process or process.is_deleted:
            raise ValueError(f"Process Master with identifier '{req.process_id}' does not exist or has been deleted.")

        if not process.is_active:
            raise ValueError(f"Process '{process.name}' is inactive. Cannot perform active billing operations.")

        # 2. Parse target date
        target_date_str = req.effective_date or date.today().isoformat()
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid effective_date format: '{target_date_str}'. Expected YYYY-MM-DD.")

        # 3. Validate Payload structure using DriverValidationService
        payload = DriverPayloadSchema(
            thickness=Decimal(str(req.thickness)) if req.thickness is not None else None,
            sub_type=req.sub_type
        )
        validation = DriverValidationService.validate_payload(process.driver_type, payload)
        if not validation.is_valid:
            err_details = "; ".join([f"{e.field}: {e.message}" for e in validation.errors])
            raise ValueError(f"Driver Validation Failure for process '{process.name}': {err_details}")

        # 4. Lookup Rate Card
        try:
            rate_card = await ProcessRateLookupService.lookup_process_rate(
                db=db,
                process_id=req.process_id,
                thickness=req.thickness,
                sub_type=req.sub_type,
                effective_date=target_date
            )
        except HTTPException as e:
            raise ValueError(e.detail)
        except Exception as e:
            raise ValueError(f"Failed to lookup rate card: {str(e)}")

        if not rate_card:
            raise ValueError(f"No active rate card on record for process '{process.name}' on or before effective date {target_date_str}.")

        # 5. Perform Decimal Cost calculations
        qty_dec = Decimal(str(req.quantity))
        rate_val_dec = Decimal(str(rate_card.rate))
        cost_decimal = qty_dec * rate_val_dec

        formula = f"{req.quantity} * {rate_card.rate} = {cost_decimal}"
        explanation = f"Calculated process cost for '{process.name}' (driver: {process.driver_type}). Multiplied driver quantity {qty_dec} with rate Rs.{rate_val_dec}/{rate_card.rate_unit}."

        # 6. Traceability Audit Trail
        audit_trail = {
            "bom_line_id": req.bom_line_id,
            "process_id": req.process_id,
            "process_code": process.name,
            "driver_type": process.driver_type,
            "driver_inputs": {
                "thickness": req.thickness,
                "sub_type": req.sub_type
            },
            "resolved_subtype": rate_card.sub_type,
            "resolved_thickness": float(rate_card.thickness_from) if rate_card.thickness_from is not None else None,
            "rate_card_id": rate_card.id,
            "effective_date_used": rate_card.effective_date.isoformat(),
            "calculation_formula": formula,
            "calculated_cost": float(cost_decimal),
            "explanation": explanation
        }

        return ProcessCalculateResponse(
            bom_line_id=req.bom_line_id,
            process_id=req.process_id,
            process_code=process.name,
            rate_card_id=rate_card.id,
            rate=float(rate_val_dec),
            rate_unit=rate_card.rate_unit,
            driver_quantity=float(qty_dec),
            resolved_driver_type=process.driver_type,
            resolved_subtype=rate_card.sub_type,
            resolved_thickness=float(rate_card.thickness_from) if rate_card.thickness_from is not None else None,
            process_cost=float(cost_decimal),
            effective_date_used=rate_card.effective_date.isoformat(),
            calculation_formula=formula,
            audit_trail_json=json.dumps(audit_trail)
        )
