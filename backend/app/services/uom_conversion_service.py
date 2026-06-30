from decimal import Decimal
from typing import Dict, Tuple

class UOMConversionService:
    # Conversions: key is (from_uom, to_uom), value is multiplier
    CONVERSION_FACTORS: Dict[Tuple[str, str], Decimal] = {
        # Mass KG <-> G
        ("KG", "G"): Decimal("1000"),
        ("G", "KG"): Decimal("0.001"),
        # Length MM <-> M
        ("M", "MM"): Decimal("1000"),
        ("MM", "M"): Decimal("0.001"),
        # Area SQMM <-> SQM
        ("SQM", "SQMM"): Decimal("1000000"),
        ("SQMM", "SQM"): Decimal("0.000001"),
    }

    @classmethod
    def normalize_uom(cls, uom: str) -> str:
        cleaned = uom.strip().upper()
        mapping = {
            "KGS": "KG",
            "GRAMS": "G",
            "METER": "M",
            "METERS": "M",
            "MMS": "MM",
            "MILLIMETERS": "MM",
            "SQ_METER": "SQM",
            "SQ-METER": "SQM",
            "SQ_MM": "SQMM",
            "SQ-MM": "SQMM"
        }
        return mapping.get(cleaned, cleaned)

    @classmethod
    def convert(cls, value: Decimal, from_uom: str, to_uom: str) -> Decimal:
        f_uom = cls.normalize_uom(from_uom)
        t_uom = cls.normalize_uom(to_uom)

        if f_uom == t_uom:
            return value

        pair = (f_uom, t_uom)
        if pair in cls.CONVERSION_FACTORS:
            return value * cls.CONVERSION_FACTORS[pair]

        compatible_groups = [
            {"KG", "G"},
            {"M", "MM"},
            {"SQM", "SQMM"}
        ]

        # Check group compatibility
        f_group = None
        t_group = None
        for grp in compatible_groups:
            if f_uom in grp:
                f_group = grp
            if t_uom in grp:
                t_group = grp

        if f_group is not None or t_group is not None:
            if f_group != t_group:
                raise ValueError(f"Incompatible UOM conversion: {from_uom} cannot be converted to {to_uom}")

        raise ValueError(f"UOM conversion not supported: {from_uom} to {to_uom}")
