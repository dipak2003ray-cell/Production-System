import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from datetime import date
import json

from backend.app.models.process import ProcessMaster
from backend.app.models.rate import RateCard
from backend.app.services.process_cost_service import ProcessCostService
from backend.app.schemas.process_cost import ProcessCalculateRequest

class TestProcessCostEngine(unittest.IsolatedAsyncioTestCase):

    # ----------------------------------------------------
    # TEST CASE 1: Laser Cutting
    # Length = 120m, Rate = ₹15/m -> Expected: ₹1,800
    # ----------------------------------------------------
    async def test_laser_cutting_process_cost(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-laser",
            name="Laser Cutting",
            driver_type="PER_METER",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-laser",
            process_id="proc-laser",
            sub_type="MS",
            thickness_from=Decimal("2.0"),
            thickness_to=Decimal("5.0"),
            rate=Decimal("15.00"),
            rate_unit="Rs/meter",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        # Mock DB execute: 1) ProcessMaster, 2) Candidate RateCards list
        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_card]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            bom_line_id="line-laser",
            process_id="proc-laser",
            quantity=120.0,
            thickness=3.0,
            sub_type="MS",
            effective_date="2026-06-24"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)

        self.assertEqual(response.process_id, "proc-laser")
        self.assertEqual(response.process_code, "Laser Cutting")
        self.assertEqual(response.rate_card_id, "rate-laser")
        self.assertEqual(response.rate, 15.00)
        self.assertEqual(response.driver_quantity, 120.0)
        self.assertEqual(response.resolved_driver_type, "PER_METER")
        self.assertEqual(response.resolved_subtype, "MS")
        self.assertEqual(response.resolved_thickness, 2.0) # thickness_from of matched card
        self.assertEqual(response.process_cost, 1800.0)

        # Audit Trail Check
        audit = json.loads(response.audit_trail_json)
        self.assertEqual(audit["bom_line_id"], "line-laser")
        self.assertEqual(audit["calculated_cost"], 1800.0)
        self.assertIn("120.0 * 15.00", audit["calculation_formula"])

    # ----------------------------------------------------
    # TEST CASE 2: Shearing
    # Cuts = 200, Rate = ₹2/cut -> Expected: ₹400
    # ----------------------------------------------------
    async def test_shearing_process_cost(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-shearing",
            name="Shearing",
            driver_type="PER_CUT",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-shearing",
            process_id="proc-shearing",
            sub_type=None,
            thickness_from=Decimal("2.0"),
            thickness_to=Decimal("5.0"),
            rate=Decimal("2.00"),
            rate_unit="Rs/cut",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_card]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            process_id="proc-shearing",
            quantity=200.0,
            thickness=3.0,
            effective_date="2026-06-24"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)

        self.assertEqual(response.process_cost, 400.0)
        self.assertEqual(response.resolved_driver_type, "PER_CUT")

    # ----------------------------------------------------
    # TEST CASE 3: Bending
    # Strokes = 150, Rate = ₹5/stroke -> Expected: ₹750
    # ----------------------------------------------------
    async def test_bending_process_cost(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-bending",
            name="Bending",
            driver_type="PER_STROKE",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-bending",
            process_id="proc-bending",
            sub_type="Bending",
            thickness_from=None,
            thickness_to=None,
            rate=Decimal("5.00"),
            rate_unit="Rs/stroke",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_card]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            process_id="proc-bending",
            quantity=150.0,
            effective_date="2026-06-24"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)

        self.assertEqual(response.process_cost, 750.0)
        self.assertEqual(response.resolved_driver_type, "PER_STROKE")
        self.assertEqual(response.resolved_subtype, "Bending")

    # ----------------------------------------------------
    # TEST CASE 4: Welding
    # Hours = 8, Rate = ₹600/hour -> Expected: ₹4,800
    # ----------------------------------------------------
    async def test_welding_process_cost(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-welding",
            name="Welding",
            driver_type="PER_HOUR",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-welding",
            process_id="proc-welding",
            sub_type="Welding",
            thickness_from=None,
            thickness_to=None,
            rate=Decimal("600.00"),
            rate_unit="Rs/hour",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_card]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            process_id="proc-welding",
            quantity=8.0,
            effective_date="2026-06-24"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)

        self.assertEqual(response.process_cost, 4800.0)
        self.assertEqual(response.resolved_driver_type, "PER_HOUR")
        self.assertEqual(response.resolved_subtype, "Welding")

    # ----------------------------------------------------
    # TEST CASE 5: Powder Coating
    # Area = 20 sqm, Rate = ₹75/sqm -> Expected: ₹1,500
    # ----------------------------------------------------
    async def test_powder_coating_process_cost(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-powder",
            name="Powder Coating",
            driver_type="PER_SQ_METER",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-powder",
            process_id="proc-powder",
            sub_type="EPOXY",
            thickness_from=None,
            thickness_to=None,
            rate=Decimal("75.00"),
            rate_unit="Rs/sqm",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_card]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            process_id="proc-powder",
            quantity=20.0,
            sub_type="EPOXY",
            effective_date="2026-06-24"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)

        self.assertEqual(response.process_cost, 1500.0)
        self.assertEqual(response.resolved_driver_type, "PER_SQ_METER")
        self.assertEqual(response.resolved_subtype, "EPOXY")

    # ----------------------------------------------------
    # TEST CASE 6: Historical Rate Resolution
    # ----------------------------------------------------
    async def test_historical_rate_resolution(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-welding",
            name="Welding",
            driver_type="PER_HOUR",
            is_active=True,
            is_deleted=False
        )

        rate_old = RateCard(
            id="rate-old",
            process_id="proc-welding",
            sub_type="Welding",
            rate=Decimal("500.00"),
            effective_date=date(2025, 1, 1),
            is_active=True,
            is_deleted=False
        )

        rate_new = RateCard(
            id="rate-new",
            process_id="proc-welding",
            sub_type="Welding",
            rate=Decimal("600.00"),
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [rate_new, rate_old]

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        # Target 2025 date (before 2026 card)
        request = ProcessCalculateRequest(
            process_id="proc-welding",
            quantity=10.0,
            effective_date="2025-06-01"
        )

        response = await ProcessCostService.calculate_line_cost(db, request)
        self.assertEqual(response.rate, 500.0)
        self.assertEqual(response.process_cost, 5000.0)

    # ----------------------------------------------------
    # TEST CASE 7: Missing Rate Card
    # ----------------------------------------------------
    async def test_missing_rate_card(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-welding",
            name="Welding",
            driver_type="PER_HOUR",
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().all.return_value = [] # Empty list of rate cards

        db.execute.side_effect = [m_exec_proc, m_exec_rate]

        request = ProcessCalculateRequest(
            process_id="proc-welding",
            quantity=10.0,
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ProcessCostService.calculate_line_cost(db, request)

        self.assertIn("No active Rate Card found", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 8: Invalid Driver Payload
    # ----------------------------------------------------
    async def test_invalid_driver_payload(self):
        db = AsyncMock()

        process = ProcessMaster(
            id="proc-laser",
            name="Laser Cutting",
            driver_type="PER_METER",
            is_active=True,
            is_deleted=False
        )

        m_exec_proc = MagicMock()
        m_exec_proc.scalars().first.return_value = process

        db.execute.side_effect = [m_exec_proc]

        # Laser Cutting (PER_METER) requires thickness, but none provided here
        request = ProcessCalculateRequest(
            process_id="proc-laser",
            quantity=100.0,
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ProcessCostService.calculate_line_cost(db, request)

        self.assertIn("Driver Validation Failure", str(context.exception))

if __name__ == "__main__":
    unittest.main()
