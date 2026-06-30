import unittest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from backend.app.models.estimate import Estimate
from backend.app.services.estimate_service import EstimateWorkflowService, EstimateRevisionService

class TestEstimateGovernance(unittest.IsolatedAsyncioTestCase):

    async def test_valid_transitions(self):
        """Verify DRAFT -> UNDER_REVIEW -> APPROVED -> LOCKED transitions succeed."""
        db = AsyncMock()

        # Mock estimate in DRAFT
        est = Estimate(
            id="est-1",
            estimate_number="EST-2026-TEST",
            status="DRAFT",
            is_deleted=False
        )

        mock_execute = MagicMock()
        mock_execute.scalars().first.return_value = est
        db.execute.return_value = mock_execute

        # 1. Transition Draft -> Under Review
        ok, err, updated = await EstimateWorkflowService.transition_status(db, "est-1", "UNDER_REVIEW", "test@ccs.com")
        self.assertTrue(ok)
        self.assertEqual(updated.status, "UNDER_REVIEW")

        # 2. Under Review -> Approved
        est.status = "UNDER_REVIEW"
        ok, err, updated = await EstimateWorkflowService.transition_status(db, "est-1", "APPROVED", "test@ccs.com")
        self.assertTrue(ok)
        self.assertEqual(updated.status, "APPROVED")

        # 3. Approved -> Locked
        est.status = "APPROVED"
        ok, err, updated = await EstimateWorkflowService.transition_status(db, "est-1", "LOCKED", "test@ccs.com")
        self.assertTrue(ok)
        self.assertEqual(updated.status, "LOCKED")

    async def test_invalid_transitions(self):
        """Verify invalid workflow transitions fail with a structured error."""
        db = AsyncMock()

        # Mock estimate in DRAFT
        est = Estimate(
            id="est-1",
            estimate_number="EST-2026-TEST",
            status="DRAFT",
            is_deleted=False
        )

        mock_execute = MagicMock()
        mock_execute.scalars().first.return_value = est
        db.execute.return_value = mock_execute

        # DRAFT -> APPROVED is invalid (must go to UNDER_REVIEW first)
        ok, err, updated = await EstimateWorkflowService.transition_status(db, "est-1", "APPROVED", "test@ccs.com")
        self.assertFalse(ok)
        self.assertIn("invalid", err.lower())

    async def test_locked_protection(self):
        """Verify that locked estimates reject edit operations or are correctly reported as locked."""
        db = AsyncMock()

        # Mock locked estimate
        est = Estimate(
            id="est-1",
            estimate_number="EST-2026-TEST",
            status="LOCKED",
            bom_header_id="bom-1",
            cost_sheet_id="cs-1",
            is_deleted=False
        )

        mock_execute_bom = MagicMock()
        mock_execute_bom.scalars().first.return_value = est
        
        # When checking lock status for bom or cs
        db.execute.return_value = mock_execute_bom

        is_bom_locked = await EstimateWorkflowService.is_locked(db, bom_header_id="bom-1")
        self.assertTrue(is_bom_locked)

        is_cs_locked = await EstimateWorkflowService.is_locked(db, cost_sheet_id="cs-1")
        self.assertTrue(is_cs_locked)

    async def test_revision_creation(self):
        """Verify spawning a revision increments numbers and clones referenced structures correctly."""
        db = AsyncMock()

        # Mock locked estimate
        est = Estimate(
            id="est-1",
            estimate_number="EST-2026-1",
            status="LOCKED",
            revision_number=1,
            bom_header_id="bom-1",
            cost_sheet_id="cs-1",
            is_deleted=False
        )

        mock_execute = MagicMock()
        mock_execute.scalars().first.return_value = est
        db.execute.return_value = mock_execute

        ok, err, new_est = await EstimateRevisionService.spawn_revision(db, "est-1", "Testing revision", "test@ccs.com")
        self.assertTrue(ok)
        self.assertEqual(new_est.revision_number, 2)
        self.assertEqual(new_est.status, "DRAFT")
        self.assertFalse(est.is_current_active)
        self.assertTrue(new_est.is_current_active)
