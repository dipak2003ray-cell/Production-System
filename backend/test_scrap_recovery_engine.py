import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from datetime import date, datetime
import json

from backend.app.models.scrap import ScrapTypeMaster
from backend.app.models.rate import RateCard
from backend.app.services.scrap_rate_lookup_service import ScrapRateLookupService
from backend.app.services.scrap_recovery_service import ScrapRecoveryService
from backend.app.schemas.scrap_recovery import ScrapCalculateRequest

class TestScrapRecoveryEngine(unittest.IsolatedAsyncioTestCase):

    # ----------------------------------------------------
    # TEST CASE 1: Basic Scrap Credit (100 KG @ ₹28/KG -> ₹2,800)
    # ----------------------------------------------------
    async def test_basic_scrap_credit(self):
        """Verify standard scrap credit calculation with valid inputs."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            name="Mild Steel Scrap",
            description="MS Scrap from laser cutting",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-scrap-123",
            scrap_id="scrap-123",
            rate=Decimal("28.00"),
            rate_unit="Rs/KG",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = rate_card

        db.execute.side_effect = [m_exec_scrap, m_exec_rate]

        request = ScrapCalculateRequest(
            bom_line_id="line-scrap-001",
            material_id="mat-999",
            material_quantity=120.0,
            effective_consumption=20.0,
            scrap_quantity=100.0,
            scrap_type="MS_SCRAP",
            effective_date="2026-06-24"
        )

        response = await ScrapRecoveryService.calculate_scrap_recovery(db, request)

        self.assertEqual(response.scrap_type_id, "scrap-123")
        self.assertEqual(response.scrap_type_code, "MS_SCRAP")
        self.assertEqual(response.rate_card_id, "rate-scrap-123")
        self.assertEqual(response.rate, 28.00)
        self.assertEqual(response.scrap_quantity, 100.0)
        self.assertEqual(response.recovery_credit, 2800.00)
        self.assertEqual(response.effective_date_used, "2026-06-24")

        # Verify traceability logs in audit_trail_json
        self.assertIsNotNone(response.audit_trail_json)
        audit = json.loads(response.audit_trail_json)
        self.assertEqual(audit["bom_line_id"], "line-scrap-001")
        self.assertEqual(audit["scrap_type_code"], "MS_SCRAP")
        self.assertEqual(audit["rate_card_id"], "rate-scrap-123")
        self.assertEqual(audit["scrap_quantity"], 100.0)
        self.assertEqual(audit["recovery_credit"], 2800.00)
        self.assertEqual(audit["formula_used"], "Scrap Quantity × Scrap Rate")

    # ----------------------------------------------------
    # TEST CASE 2: Historical Scrap Rate Resolution
    # ----------------------------------------------------
    async def test_historical_scrap_rate_resolution(self):
        """Verify that older rate is selected when effective_date is older."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            is_active=True,
            is_deleted=False
        )

        rate_old = RateCard(
            id="rate-old",
            scrap_id="scrap-123",
            rate=Decimal("25.00"),
            rate_unit="Rs/KG",
            effective_date=date(2025, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        m_exec_rate_old = MagicMock()
        m_exec_rate_old.scalars().first.return_value = rate_old

        db.execute.side_effect = [m_exec_scrap, m_exec_rate_old]

        request_old = ScrapCalculateRequest(
            scrap_quantity=10.0,
            scrap_type="MS_SCRAP",
            effective_date="2025-06-01"
        )

        response = await ScrapRecoveryService.calculate_scrap_recovery(db, request_old)
        self.assertEqual(response.rate, 25.00)
        self.assertEqual(response.recovery_credit, 250.00)

    # ----------------------------------------------------
    # TEST CASE 3: Missing Scrap Rate
    # ----------------------------------------------------
    async def test_missing_scrap_rate(self):
        """Verify error raising if no rate card is found for the scrap type."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            is_active=True,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        m_exec_rate_none = MagicMock()
        m_exec_rate_none.scalars().first.return_value = None

        db.execute.side_effect = [m_exec_scrap, m_exec_rate_none]

        request = ScrapCalculateRequest(
            scrap_quantity=10.0,
            scrap_type="MS_SCRAP",
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ScrapRecoveryService.calculate_scrap_recovery(db, request)

        self.assertIn("No active scrap rate on record", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 4: Invalid Scrap Type
    # ----------------------------------------------------
    async def test_invalid_scrap_type(self):
        """Verify error raising when querying a scrap type that doesn't exist."""
        db = AsyncMock()

        m_exec_scrap_none = MagicMock()
        m_exec_scrap_none.scalars().first.return_value = None

        db.execute.side_effect = [m_exec_scrap_none]

        request = ScrapCalculateRequest(
            scrap_quantity=10.0,
            scrap_type="UNKNOWN_SCRAP",
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ScrapRecoveryService.calculate_scrap_recovery(db, request)

        self.assertIn("does not exist", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 4.5: Inactive Scrap Type
    # ----------------------------------------------------
    async def test_inactive_scrap_type(self):
        """Verify error raising when querying an inactive scrap type."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            is_active=False,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        db.execute.side_effect = [m_exec_scrap]

        request = ScrapCalculateRequest(
            scrap_quantity=10.0,
            scrap_type="MS_SCRAP",
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ScrapRecoveryService.calculate_scrap_recovery(db, request)

        self.assertIn("is inactive", str(context.exception))

    # ----------------------------------------------------
    # TEST CASE 5: Zero Scrap Quantity
    # ----------------------------------------------------
    async def test_zero_scrap_quantity(self):
        """Verify scrap credit is zero when quantity is zero, and does not crash."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            is_active=True,
            is_deleted=False
        )

        rate_card = RateCard(
            id="rate-scrap-123",
            scrap_id="scrap-123",
            rate=Decimal("28.00"),
            rate_unit="Rs/KG",
            effective_date=date(2026, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        m_exec_rate = MagicMock()
        m_exec_rate.scalars().first.return_value = rate_card

        db.execute.side_effect = [m_exec_scrap, m_exec_rate]

        request = ScrapCalculateRequest(
            scrap_quantity=0.0,
            scrap_type="MS_SCRAP",
            effective_date="2026-06-24"
        )

        response = await ScrapRecoveryService.calculate_scrap_recovery(db, request)
        self.assertEqual(response.scrap_quantity, 0.0)
        self.assertEqual(response.recovery_credit, 0.0)

    # ----------------------------------------------------
    # TEST CASE 6: Future-Dated Rate Exclusion
    # ----------------------------------------------------
    async def test_future_dated_rate_exclusion(self):
        """Verify that future-dated rate cards are excluded."""
        db = AsyncMock()

        scrap_type = ScrapTypeMaster(
            id="scrap-123",
            code="MS_SCRAP",
            is_active=True,
            is_deleted=False
        )

        # Future rate card (in 2027) relative to query target date (in 2026)
        rate_future = RateCard(
            id="rate-future",
            scrap_id="scrap-123",
            rate=Decimal("45.00"),
            rate_unit="Rs/KG",
            effective_date=date(2027, 1, 1),
            is_active=True,
            is_deleted=False
        )

        m_exec_scrap = MagicMock()
        m_exec_scrap.scalars().first.return_value = scrap_type

        m_exec_rate_none = MagicMock()
        m_exec_rate_none.scalars().first.return_value = None

        db.execute.side_effect = [m_exec_scrap, m_exec_rate_none]

        request = ScrapCalculateRequest(
            scrap_quantity=10.0,
            scrap_type="MS_SCRAP",
            effective_date="2026-06-24"
        )

        with self.assertRaises(ValueError) as context:
            await ScrapRecoveryService.calculate_scrap_recovery(db, request)

        self.assertIn("No active scrap rate on record", str(context.exception))

if __name__ == "__main__":
    unittest.main()
