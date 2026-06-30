from pydantic import BaseModel, Field, model_validator
from typing import Optional, Dict, Any, List
from datetime import date
from decimal import Decimal

# Driver Category enums (as standard string enum or plain values as requested)
class DriverCategory:
    PER_METER = "PER_METER"
    PER_CUT = "PER_CUT"
    PER_STROKE = "PER_STROKE"
    PER_HOUR = "PER_HOUR"
    PER_SQ_METER = "PER_SQ_METER"

class ProcessDriverMetadataSchema(BaseModel):
    driver_type: str = Field(..., description="Unique category key e.g. PER_METER, PER_CUT etc.")
    sub_type_from_driver: bool = Field(default=False, description="Whether sub-type is dynamically determined from user input")
    thickness_from_driver: bool = Field(default=False, description="Whether thickness ranges are dynamically looked up")
    fixed_sub_type: Optional[str] = Field(None, description="Static pre-defined sub-type used as fallback or direct filter")

class DriverPayloadSchema(BaseModel):
    thickness: Optional[Decimal] = Field(None, description="Input physical thickness in mm")
    sub_type: Optional[str] = Field(None, description="Dynamic specification element e.g. MS, SS, EPOXY")

class DriverValidationRequest(BaseModel):
    process_id: str = Field(..., description="ID of the Process Master being evaluated")
    payload: DriverPayloadSchema = Field(..., description="Input parameters provided to the process")

class ValidationErrorDetail(BaseModel):
    field: str
    message: str

class DriverValidationResponse(BaseModel):
    is_valid: bool
    driver_type: Optional[str] = None
    resolved_sub_type: Optional[str] = None
    resolved_thickness: Optional[Decimal] = None
    errors: List[ValidationErrorDetail] = Field(default_factory=list)

class RateResolutionRequest(BaseModel):
    process_id: str = Field(..., description="Process Master target identifier")
    payload: DriverPayloadSchema = Field(..., description="Input driver parameters")
    effective_date: Optional[date] = Field(default_factory=date.today, description="Effective lookup target date")

class RateResolutionResultResponse(BaseModel):
    rate_card_id: str = Field(..., description="Matched rate card database record")
    rate: Decimal = Field(..., description="Precision matched rate value")
    rate_unit: str = Field(..., description="Rate payment units used")
    resolved_sub_type: Optional[str] = None
    resolved_thickness: Optional[Decimal] = None
    effective_date: date
    message: Optional[str] = None
