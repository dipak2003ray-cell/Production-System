import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from datetime import date, datetime
import json

from backend.app.models.material import MaterialMaster
from backend.app.models.rate import RateCard
from backend.app.services.uom_conversion_service import UOMConversionService
from backend.app.services.material_rate_lookup_service import MaterialRateLookupService
from backend.app.services.material_cost_service import MaterialCostService
from backend.app.schemas.material_cost import MaterialCalculateRequest

class TestMaterialCostEngine(unittest.IsolatedAsyncioTestCase):

    # ----------------------------------------------------
    # TEST CASE 1: Simple Material Cost
    # ----------------------------------------------------
    async def test_simple_material_cost(self):
        """Verify standard material calculation with matching UOMs and no waste."""
        db = AsyncMock()
        
        material = MaterialMaster(
            id="mat-123",
            code="MAT-MS-001",
            description="Mild Steel Sheet",
            std_unit="KG",
            is_deleted=False
        )
        
        rate_card = RateCard(
            id="rate-123",
            material_id="mat-123",
            rate=Decimal("85.50"),
            rate_unit="Rs/KG",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        # Mock DB execute calls for:
        # 1) Material master retrieval
        # 2) Rate card standard lookup
        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        
        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = rate_card
        
        db.execute.side_effect = [m_exec_mat, m_exec_rate]

        request = MaterialCalculateRequest(
            bom_line_id="line-abc",
            material_id="mat-123",
            quantity=100.0,
            uom="KG",
            waste_modifier=1.0,
            effective_date="2026-06-24"
        )

        response = await MaterialCostService.calculate_line_cost(db, request)

        self.assertEqual(response.material_id, "mat-123")
        self.assertEqual(response.material_code, "MAT-MS-001")
        self.assertEqual(response.rate_card_id, "rate-123")
        self.assertEqual(response.rate, 85.50)
        self.assertEqual(response.original_quantity, 100.0)
        self.assertEqual(response.resolved_quantity, 100.0)
        self.assertEqual(response.resolved_uom, "KG")
        self.assertEqual(response.waste_modifier, 1.0)
        self.assertEqual(response.waste_quantity, 0.0)
        self.assertEqual(response.effective_quantity, 100.0)
        self.assertEqual(response.material_subtotal, 8550.0)
        self.assertEqual(response.conversion_applied, "None")
        
        # Verify Traceability
        self.assertIsNotNone(response.audit_trail_json)
        audit = json.loads(response.audit_trail_json)
        self.assertEqual(audit["bom_line_id"], "line-abc")
        self.assertEqual(audit["rate_used"], 85.50)
        self.assertEqual(audit["calculated_subtotal"], 8550.0)

    # ----------------------------------------------------
    # TEST CASE 2: Historical Rate Resolution
    # ----------------------------------------------------
    async def test_historical_rate_resolution(self):
        """Verify rate selection respects effective_date precedence filters."""
        db = AsyncMock()
        
        material = MaterialMaster(
            id="mat-123",
            code="MAT-MS-001",
            std_unit="KG",
            is_deleted=False
        )

        # Rate card active in 2025
        rate_old = RateCard(
            id="rate-old",
            material_id="mat-123",
            rate=Decimal("70.00"),
            rate_unit="Rs/KG",
            effective_date=date(2025, 1, 1),
            is_active=True,
            is_deleted=False
        )

        # Rate card active in 2026
        rate_new = RateCard(
            id="rate-new",
            material_id="mat-123",
            rate=Decimal("90.00"),
            rate_unit="Rs/KG",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        # Mock DB response for Material Master
        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        
        # Mock DB response for RateCard: return the old rate for an older date query
        m_exec_rate_old = MagicMock()
        m_exec_rate_old.scalars().first.return_value = rate_old

        db.execute.side_effect = [m_exec_mat, m_exec_rate_old]

        request_old = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="KG",
            effective_date="2025-06-01"  # Before 2026 card
        )

        response_old = await MaterialCostService.calculate_line_cost(db, request_old)
        self.assertEqual(response_old.rate, 70.00)
        self.assertEqual(response_old.material_subtotal, 700.00)

    # ----------------------------------------------------
    # TEST CASE 3: UOM Conversion (KG <-> G, MM <-> M, SQMM <-> SQM)
    # ----------------------------------------------------
    def test_uom_conversions(self):
        """Verify valid conversion mappings and unit normalization."""
        # Mass Conversion
        self.assertEqual(UOMConversionService.convert(Decimal("1.5"), "KG", "G"), Decimal("1500"))
        self.assertEqual(UOMConversionService.convert(Decimal("2500"), "G", "KG"), Decimal("2.5"))
        # Length Conversion
        self.assertEqual(UOMConversionService.convert(Decimal("2"), "M", "MM"), Decimal("2000"))
        self.assertEqual(UOMConversionService.convert(Decimal("500"), "MM", "M"), Decimal("0.5"))
        # Area Conversion
        self.assertEqual(UOMConversionService.convert(Decimal("1.2"), "SQM", "SQMM"), Decimal("1200000"))
        self.assertEqual(UOMConversionService.convert(Decimal("5000000"), "SQMM", "SQM"), Decimal("5"))

        # Check normalization
        self.assertEqual(UOMConversionService.normalize_uom("KGS"), "KG")
        self.assertEqual(UOMConversionService.normalize_uom("grams"), "G")
        self.assertEqual(UOMConversionService.normalize_uom("sq-meter"), "SQM")

    # ----------------------------------------------------
    # TEST CASE 4: Waste Factor Calculation
    # ----------------------------------------------------
    async def test_waste_factor_calculation(self):
        """Verify raw quantity with waste multiplier (e.g. 5% and 10%)."""
        db = AsyncMock()
        
        material = MaterialMaster(id="mat-123", code="MAT-MS-001", std_unit="KG", is_deleted=False)
        rate_card = RateCard(id="rate-123", material_id="mat-123", rate=Decimal("100.00"), rate_unit="Rs/KG", effective_date=date(2026, 1, 1), is_active=True, is_deleted=False)

        # First query: 5% waste
        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = rate_card
        db.execute.side_effect = [m_exec_mat, m_exec_rate]

        request_5 = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="KG",
            waste_modifier=1.05,  # 5% waste
            effective_date="2026-06-24"
        )
        response_5 = await MaterialCostService.calculate_line_cost(db, request_5)
        self.assertEqual(response_5.resolved_quantity, 10.0)
        self.assertEqual(response_5.waste_modifier, 1.05)
        self.assertEqual(response_5.waste_quantity, 0.5)
        self.assertEqual(response_5.effective_quantity, 10.5)
        self.assertEqual(response_5.material_subtotal, 1050.0)

        # Second query: 10% waste
        db.execute.side_effect = [m_exec_mat, m_exec_rate]
        request_10 = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="KG",
            waste_modifier=1.10,  # 10% waste
            effective_date="2026-06-24"
        )
        response_10 = await MaterialCostService.calculate_line_cost(db, request_10)
        self.assertEqual(response_10.waste_quantity, 1.0)
        self.assertEqual(response_10.effective_quantity, 11.0)
        self.assertEqual(response_10.material_subtotal, 1100.0)

    # ----------------------------------------------------
    # TEST CASE 5: Invalid UOM Conversion
    # ----------------------------------------------------
    async def test_invalid_uom_conversion(self):
        """Verify mismatched dimension conversions are explicitly rejected."""
        db = AsyncMock()
        
        material = MaterialMaster(id="mat-123", code="MAT-MS-001", std_unit="KG", is_deleted=False)
        rate_card = RateCard(id="rate-123", material_id="mat-123", rate=Decimal("10.00"), rate_unit="Rs/KG", effective_date=date(2026, 1, 1), is_active=True, is_deleted=False)

        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = rate_card
        db.execute.side_effect = [m_exec_mat, m_exec_rate]

        request = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="HOURS",  # Invalid dimension
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await MaterialCostService.calculate_line_cost(db, request)
        
        self.assertIn("Incompatible UOM conversion", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 6: Missing Rate Card
    # ----------------------------------------------------
    async def test_missing_rate_card(self):
        """Verify error raising if no rate card matches the target parameters."""
        db = AsyncMock()
        
        material = MaterialMaster(id="mat-123", code="MAT-MS-001", std_unit="KG", is_deleted=False)

        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = None  # No matching rate card
        db.execute.side_effect = [m_exec_mat, m_exec_rate]

        request = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="KG",
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await MaterialCostService.calculate_line_cost(db, request)
        
        self.assertIn("No active rate card on record", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 7: Future-Dated Rate Handling
    # ----------------------------------------------------
    async def test_future_dated_rate_handling(self):
        """Verify that future-dated rate cards are not selected."""
        db = AsyncMock()
        
        material = MaterialMaster(id="mat-123", code="MAT-MS-001", std_unit="KG", is_deleted=False)
        
        # Future card relative to our target query
        rate_future = RateCard(
            id="rate-future",
            material_id="mat-123",
            rate=Decimal("150.00"),
            rate_unit="Rs/KG",
            effective_date=date(2027, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_mat = MagicMock()
        m_exec_mat.scalars().first.return_value = material
        
        m_exec_rate_none = MagicMock()
        m_exec_rate_none.scalars().first.return_value = None  # None on or before effective date

        db.execute.side_effect = [m_exec_mat, m_exec_rate_none]

        request = MaterialCalculateRequest(
            material_id="mat-123",
            quantity=10.0,
            uom="KG",
            effective_date="2026-06-24"  # Querying in 2026, so future 2027 card should not match
        )

        with self.assertRaises(ValueError) as context:
            await MaterialCostService.calculate_line_cost(db, request)
            
        self.assertIn("No active rate card on record", str(context.exception))

if __name__ == "__main__":
    unittest.main()
