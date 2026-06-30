import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from datetime import date, timedelta
import asyncio

# Import structures of interest
from backend.app.schemas.process_driver import DriverPayloadSchema
from backend.app.services.driver_validation_service import DriverValidationService
from backend.app.services.rate_lookup_service import RateLookupService
from backend.app.models.process import ProcessMaster
from backend.app.models.rate import RateCard

class TestProcessDriverValidation(unittest.TestCase):
    def test_laser_cutting_validation(self):
        """Laser Cutting requires both thickness and dynamic sub_type."""
        # 1. Valid inputs: 2mm, 3mm, 6mm
        for thk in [Decimal("2.0"), Decimal("3.0"), Decimal("6.0")]:
            payload = DriverPayloadSchema(thickness=thk, sub_type="MS")
            res = DriverValidationService.validate_payload("PER_METER", payload)
            self.assertTrue(res.is_valid, f"Laser Cutting with thickness {thk} and MS should be valid.")
            self.assertEqual(res.resolved_sub_type, "MS")
            self.assertEqual(res.resolved_thickness, thk)

        # 2. Missing thickness
        payload = DriverPayloadSchema(sub_type="MS")
        res = DriverValidationService.validate_payload("PER_METER", payload)
        self.assertFalse(res.is_valid)
        self.assertTrue(any("thickness" in e.field for e in res.errors))

        # 3. Missing subtype
        payload = DriverPayloadSchema(thickness=Decimal("3.0"))
        res = DriverValidationService.validate_payload("PER_METER", payload)
        self.assertFalse(res.is_valid)
        self.assertTrue(any("sub_type" in e.field for e in res.errors))

        # 4. Non-positive thickness
        payload = DriverPayloadSchema(thickness=Decimal("-1.0"), sub_type="AL")
        res = DriverValidationService.validate_payload("PER_METER", payload)
        self.assertFalse(res.is_valid)
        self.assertTrue(any("thickness" in e.field for e in res.errors))

    def test_shearing_validation(self):
        """Shearing requires thickness but no subtype."""
        # Valid inputs
        payload = DriverPayloadSchema(thickness=Decimal("5.0"))
        res = DriverValidationService.validate_payload("PER_CUT", payload)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.resolved_thickness, Decimal("5.0"))
        self.assertIsNone(res.resolved_sub_type)

        # Invalid: missing thickness
        payload = DriverPayloadSchema()
        res = DriverValidationService.validate_payload("PER_CUT", payload)
        self.assertFalse(res.is_valid)

    def test_bending_validation(self):
        """Bending driver uses a fixed subtype of 'Bending' and does not permit thickness."""
        # Valid inputs
        payload = DriverPayloadSchema()
        res = DriverValidationService.validate_payload("PER_STROKE", payload)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.resolved_sub_type, "BENDING")
        self.assertIsNone(res.resolved_thickness)

        # Invalid: unexpected thickness parameter
        payload = DriverPayloadSchema(thickness=Decimal("2.0"))
        res = DriverValidationService.validate_payload("PER_STROKE", payload)
        self.assertFalse(res.is_valid)
        self.assertTrue(any("thickness" in e.field for e in res.errors))

        # Invalid: mismatched sub_type
        payload = DriverPayloadSchema(sub_type="OTHER")
        res = DriverValidationService.validate_payload("PER_STROKE", payload)
        self.assertFalse(res.is_valid)
        self.assertTrue(any("sub_type" in e.field for e in res.errors))

    def test_welding_validation(self):
        """Welding has PER_HOUR and fixed 'Welding' subtype."""
        payload = DriverPayloadSchema()
        res = DriverValidationService.validate_payload("PER_HOUR", payload)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.resolved_sub_type, "WELDING")

    def test_powder_coating_validation(self):
        """Powder Coating has PER_SQ_METER, dynamic sub-type, no thickness."""
        payload = DriverPayloadSchema(sub_type="EPOXY")
        res = DriverValidationService.validate_payload("PER_SQ_METER", payload)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.resolved_sub_type, "EPOXY")

        # Missing subtype
        payload = DriverPayloadSchema()
        res = DriverValidationService.validate_payload("PER_SQ_METER", payload)
        self.assertFalse(res.is_valid)


class TestRateLookupResolution(unittest.IsolatedAsyncioTestCase):
    async def test_resolved_mock_laser_rate(self):
        """Simulates actual RateLookupService.resolve_rate_card queries using mocks."""
        db_session = AsyncMock()

        # Mocking Process query response
        process_mock = ProcessMaster(
            id="proc-123",
            name="Laser Cutting",
            driver_type="PER_METER",
            is_active=True,
            is_deleted=False
        )
        execute_process_mock = MagicMock()
        execute_process_mock.scalars().first.return_value = process_mock
        
        # Rate card candidate mock records
        rc1 = RateCard(
            id="rc-1",
            process_id="proc-123",
            sub_type="MS",
            thickness_from=Decimal("0.0"),
            thickness_to=Decimal("2.5"),
            rate=Decimal("15.50"),
            rate_unit="Rs/meter",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )
        rc2 = RateCard(
            id="rc-2",
            process_id="proc-123",
            sub_type="MS",
            thickness_from=Decimal("2.5"),
            thickness_to=Decimal("5.0"),
            rate=Decimal("22.00"),
            rate_unit="Rs/meter",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )
        
        # Set database mock result chain
        execute_rates_mock = MagicMock()
        execute_rates_mock.scalars().all.return_value = [rc1, rc2]

        # Configure db.execute mock side_effects to return ProcessMaster first, then list of RateCards
        db_session.execute.side_effect = [execute_process_mock, execute_rates_mock]

        payload = DriverPayloadSchema(thickness=Decimal("3.0"), sub_type="MS")
        resolved = await RateLookupService.resolve_rate_card(
            db=db_session,
            process_id="proc-123",
            payload=payload,
            effective_date=date(2026, 6, 1)
        )

        self.assertEqual(resolved.id, "rc-2")
        self.assertEqual(resolved.rate, Decimal("22.00"))


    async def test_historical_rate_date_matching(self):
        """Verifies date alignment prefers the closest older effective date card."""
        db_session = AsyncMock()

        process_mock = ProcessMaster(
            id="proc-123",
            name="Welding",
            driver_type="PER_HOUR",
            is_active=True,
            is_deleted=False
        )
        execute_process_mock = MagicMock()
        execute_process_mock.scalars().first.return_value = process_mock

        # Standard historical record setup
        rc_old = RateCard(
            id="rc-old",
            process_id="proc-123",
            sub_type="WELDING",
            rate=Decimal("100.00"),
            effective_date=date(2025, 1, 1),
            is_active=True,
            is_deleted=False
        )
        rc_new = RateCard(
            id="rc-new",
            process_id="proc-123",
            sub_type="WELDING",
            rate=Decimal("120.00"),
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        execute_rates_mock = MagicMock()
        execute_rates_mock.scalars().all.return_value = [rc_new, rc_old]  # ordered by date desc

        db_session.execute.side_effect = [execute_process_mock, execute_rates_mock]

        payload = DriverPayloadSchema()
        # Query for historical date in 2025
        resolved_historical = await RateLookupService.resolve_rate_card(
            db=db_session,
            process_id="proc-123",
            payload=payload,
            effective_date=date(2025, 6, 1)
        )
        self.assertEqual(resolved_historical.id, "rc-old")
        self.assertEqual(resolved_historical.rate, Decimal("100.00"))


if __name__ == "__main__":
    unittest.main()
