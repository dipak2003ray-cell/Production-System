from decimal import Decimal
from typing import Dict, Any, List, Optional
from ..schemas.process_driver import DriverPayloadSchema, ValidationErrorDetail, DriverValidationResponse

DRIVER_METADATA: Dict[str, Dict[str, Any]] = {
    "PER_METER": {
        "sub_type_from_driver": True,
        "thickness_from_driver": True,
        "fixed_sub_type": None
    },
    "PER_CUT": {
        "sub_type_from_driver": False,
        "thickness_from_driver": True,
        "fixed_sub_type": None
    },
    "PER_STROKE": {
        "sub_type_from_driver": False,
        "thickness_from_driver": False,
        "fixed_sub_type": "Bending"
    },
    "PER_HOUR": {
        "sub_type_from_driver": False,
        "thickness_from_driver": False,
        "fixed_sub_type": "Welding"
    },
    "PER_SQ_METER": {
        "sub_type_from_driver": True,
        "thickness_from_driver": False,
        "fixed_sub_type": None
    }
}

class DriverValidationService:
    @staticmethod
    def get_supported_drivers() -> List[str]:
        return list(DRIVER_METADATA.keys())

    @staticmethod
    def get_metadata(driver_type: Optional[str]) -> Optional[Dict[str, Any]]:
        if not driver_type:
            return None
        # Support case-insensitive lookup
        key = driver_type.upper().strip()
        return DRIVER_METADATA.get(key)

    @classmethod
    def validate_payload(cls, driver_type: Optional[str], payload: DriverPayloadSchema) -> DriverValidationResponse:
        errors: List[ValidationErrorDetail] = []
        resolved_sub_type: Optional[str] = None
        resolved_thickness: Optional[Decimal] = None

        if not driver_type:
            errors.append(ValidationErrorDetail(
                field="driver_type",
                message="Process has no defined process driver type. Cannot evaluate configuration rules."
            ))
            return DriverValidationResponse(
                is_valid=False,
                errors=errors
            )

        norm_driver = driver_type.upper().strip()
        meta = cls.get_metadata(norm_driver)

        if not meta:
            # Unknown user driver fallback
            errors.append(ValidationErrorDetail(
                field="driver_type",
                message=f"Driver configuration '{driver_type}' is unsupported or unregistered."
            ))
            return DriverValidationResponse(
                is_valid=False,
                errors=errors
            )

        # 1. Thickness evaluation
        if meta["thickness_from_driver"]:
            if payload.thickness is None:
                errors.append(ValidationErrorDetail(
                    field="thickness",
                    message="Missing required physical thickness value under dynamic thickness driver rule."
                ))
            else:
                try:
                    t_val = Decimal(str(payload.thickness))
                    if t_val <= Decimal("0"):
                        errors.append(ValidationErrorDetail(
                            field="thickness",
                            message="Thickness constraint values must be strictly greater than 0 mm."
                        ))
                    else:
                        resolved_thickness = t_val
                except Exception:
                    errors.append(ValidationErrorDetail(
                        field="thickness",
                        message="Thickness specification is not a valid decimal number."
                    ))
        else:
            # Reject thickness when not supported by driver
            if payload.thickness is not None:
                errors.append(ValidationErrorDetail(
                    field="thickness",
                    message=f"Thickness constraints are not supported under process driver '{norm_driver}'."
                ))

        # 2. Subtype evaluation
        if meta["sub_type_from_driver"]:
            if not payload.sub_type or not payload.sub_type.strip():
                errors.append(ValidationErrorDetail(
                    field="sub_type",
                    message="Missing required dynamic material specification / sub-type key."
                ))
            else:
                resolved_sub_type = payload.sub_type.strip().upper()
        else:
            # Fixed subtype or none
            if payload.sub_type is not None and payload.sub_type.strip() != "":
                # If they supply custom sub_type when driver is welding/bending, is that permitted or should we validate?
                # The fixed_sub_type overrides or specifies the mapping.
                # Let's enforce that if they supply an unexpected sub_type it warns/fails.
                fixed_val = meta["fixed_sub_type"]
                if fixed_val and payload.sub_type.strip().upper() != fixed_val.upper():
                    errors.append(ValidationErrorDetail(
                        field="sub_type",
                        message=f"Custom sub_type not permitted. Process driver '{norm_driver}' forces a static value of '{fixed_val}'."
                    ))
            
            # If nothing or allowed, we resolve the fixed code
            resolved_sub_type = meta["fixed_sub_type"]

        return DriverValidationResponse(
            is_valid=len(errors) == 0,
            driver_type=norm_driver,
            resolved_sub_type=resolved_sub_type,
            resolved_thickness=resolved_thickness,
            errors=errors
        )
