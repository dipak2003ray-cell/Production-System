from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.process import ProcessMaster
from ..schemas.process_driver import (
    ProcessDriverMetadataSchema,
    DriverValidationRequest,
    DriverValidationResponse,
    RateResolutionRequest,
    RateResolutionResultResponse,
    ValidationErrorDetail
)
from ..services.process_driver_service import ProcessDriverService
from ..services.driver_validation_service import DriverValidationService
from ..services.rate_lookup_service import RateLookupService

router = APIRouter(prefix="/process-drivers", tags=["Process Driver Framework"])

@router.get("", response_model=List[ProcessDriverMetadataSchema])
async def list_drivers():
    """List all supported process driver types with design definitions."""
    return ProcessDriverService.list_supported_drivers()

@router.post("/validate", response_model=DriverValidationResponse)
async def validate_driver(request: DriverValidationRequest, db: AsyncSession = Depends(get_db)):
    """Validates if a given payload matches all structural process driver constraints."""
    proc_res = await db.execute(
        select(ProcessMaster).filter(ProcessMaster.id == request.process_id, ProcessMaster.is_deleted == False)
    )
    process = proc_res.scalars().first()
    if not process:
        return DriverValidationResponse(
            is_valid=False,
            errors=[
                ValidationErrorDetail(
                    field="process_id",
                    message=f"Process Master record with id '{request.process_id}' was not found in database."
                )
            ]
        )

    return DriverValidationService.validate_payload(process.driver_type, request.payload)

@router.post("/resolve-rate", response_model=RateResolutionResultResponse)
async def resolve_rate_endpoint(request: RateResolutionRequest, db: AsyncSession = Depends(get_db)):
    """Resolves and selects the precise matching active rate card."""
    matched_rate = await RateLookupService.resolve_rate_card(
        db=db,
        process_id=request.process_id,
        payload=request.payload,
        effective_date=request.effective_date
    )

    # Determine resolved values for response
    proc_res = await db.execute(
        select(ProcessMaster).filter(ProcessMaster.id == request.process_id, ProcessMaster.is_deleted == False)
    )
    process = proc_res.scalars().first()
    driver_type = process.driver_type if process else None

    validation = DriverValidationService.validate_payload(driver_type, request.payload)

    return RateResolutionResultResponse(
        rate_card_id=matched_rate.id,
        rate=matched_rate.rate,
        rate_unit=matched_rate.rate_unit,
        resolved_sub_type=validation.resolved_sub_type,
        resolved_thickness=validation.resolved_thickness,
        effective_date=matched_rate.effective_date,
        message="Rate successfully resolved via custom Process Driver engine alignment."
    )
