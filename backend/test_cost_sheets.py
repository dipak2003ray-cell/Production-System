import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
import asyncio

from backend.app.models.cost_sheet import CostSheetHeader, CostSheetLine, CostCalculationSnapshot
from backend.app.services.cost_sheet_service import CostSheetService
from backend.app.schemas.cost_sheet import CostSheetHeaderCreate, CostSheetLineCreate

class TestCostSheetLifecycleAndOperations(unittest.IsolatedAsyncioTestCase):

    async def test_create_cost_sheet(self):
        """Unit test: creating a Cost Sheet header correctly saves models and returns the fresh instance."""
        db = AsyncMock()
        
        create_schema = CostSheetHeaderCreate(
            bom_header_id="bom-id-abc",
            revision_number=1,
            status="DRAFT",
            total_material_cost=Decimal("1500.50"),
            total_process_cost=Decimal("750.00"),
            total_scrap_credit=Decimal("120.00"),
            total_overhead_cost=Decimal("300.00"),
            grand_total_cost=Decimal("2430.50"),
            lines=[
                CostSheetLineCreate(
                    bom_line_id="bom-line-1",
                    parent_cost_line_id=None,
                    item_type="MATERIAL",
                    base_rate=Decimal("10.00"),
                    raw_quantity=Decimal("150.05"),
                    waste_modifier=Decimal("1.00"),
                    calculated_subtotal=Decimal("1500.50")
                )
            ]
        )
        
        # Invoke creator service
        cost_sheet = await CostSheetService.create_cost_sheet(db, create_schema, "estimator@ccs.com")
        
        self.assertIsNotNone(cost_sheet.cost_sheet_number)
        self.assertTrue(cost_sheet.cost_sheet_number.startswith("CS-"))
        self.assertEqual(cost_sheet.bom_header_id, "bom-id-abc")
        self.assertEqual(cost_sheet.status, "DRAFT")
        self.assertEqual(cost_sheet.created_by, "estimator@ccs.com")
        
        # Verify db.add is called for header and lines
        self.assertTrue(db.add.called)
        self.assertTrue(db.commit.called)

    async def test_get_cost_sheet_resolves_lines(self):
        """Unit test: get_cost_sheet fetches the header and its attached line items from db."""
        db = AsyncMock()
        
        header = CostSheetHeader(
            id="cs-id-123",
            cost_sheet_number="CS-00001",
            bom_header_id="bom-1",
            revision_number=1,
            status="DRAFT",
            total_material_cost=Decimal("100"),
            total_process_cost=0,
            total_scrap_credit=0,
            total_overhead_cost=0,
            grand_total_cost=Decimal("100"),
            is_deleted=False
        )
        lines = [
            CostSheetLine(id="line-x", cost_sheet_header_id="cs-id-123", item_type="MATERIAL", calculated_subtotal=100)
        ]
        
        # Define mock db execute series
        m_exec_header = MagicMock()
        m_exec_header.scalars().first.return_value = header
        
        m_exec_lines = MagicMock()
        m_exec_lines.scalars().all.return_value = lines
        
        db.execute.side_effect = [m_exec_header, m_exec_lines]
        
        res = await CostSheetService.get_cost_sheet(db, "cs-id-123")
        self.assertIsNotNone(res)
        self.assertEqual(res.id, "cs-id-123")
        self.assertEqual(len(res.lines), 1)
        self.assertEqual(res.lines[0].id, "line-x")

    async def test_update_draft_cost_sheet(self):
        """Integration test: modifying an open draft status works successfully, updating header sums."""
        db = AsyncMock()
        
        header = CostSheetHeader(
            id="cs-draft",
            cost_sheet_number="CS-00002",
            bom_header_id="bom-1",
            revision_number=1,
            status="DRAFT",
            grand_total_cost=Decimal("1000.00"),
            is_deleted=False
        )
        existing_lines = [
            CostSheetLine(id="l-keep", cost_sheet_header_id="cs-draft", item_type="MATERIAL")
        ]
        
        m_exec_header = MagicMock()
        m_exec_header.scalars().first.return_value = header
        
        m_exec_lines = MagicMock()
        m_exec_lines.scalars().all.return_value = existing_lines
        
        db.execute.side_effect = [
            m_exec_header,  # For load within update
            m_exec_lines    # For fetching existing lines
        ]
        
        update_schema = CostSheetHeaderCreate(
            bom_header_id="bom-1",
            revision_number=1,
            status="DRAFT",
            total_material_cost=Decimal("2000.00"),
            total_process_cost=0,
            total_scrap_credit=0,
            total_overhead_cost=0,
            grand_total_cost=Decimal("2000.00"),
            lines=[]  # Clear lines during update
        )
        
        res = await CostSheetService.update_cost_sheet(db, "cs-draft", update_schema)
        self.assertEqual(res.grand_total_cost, Decimal("2000.00"))
        self.assertTrue(db.commit.called)

    async def test_update_locked_sheet_raises_error(self):
        """Lifecycle test: mutation attempts on LOCKED sheet must raise status value violations."""
        db = AsyncMock()
        
        header = CostSheetHeader(
            id="cs-locked",
            cost_sheet_number="CS-00003",
            bom_header_id="bom-1",
            revision_number=1,
            status="LOCKED",
            is_deleted=False
        )
        
        m_exec = MagicMock()
        m_exec.scalars().first.return_value = header
        db.execute.return_value = m_exec
        
        update_schema = CostSheetHeaderCreate(
            bom_header_id="bom-1",
            revision_number=1,
            status="DRAFT",
            total_material_cost=0,
            total_process_cost=0,
            total_scrap_credit=0,
            total_overhead_cost=0,
            grand_total_cost=0,
            lines=[]
        )
        
        with self.assertRaises(ValueError) as context:
            await CostSheetService.update_cost_sheet(db, "cs-locked", update_schema)
        
        self.assertIn("cannot be updated", str(context.exception))

    async def test_lock_transition_generates_snapshot(self):
        """Lifecycle test: locking transitions status to LOCKED and establishes frozen Snapshot record."""
        db = AsyncMock()
        
        header = CostSheetHeader(
            id="cs-to-lock",
            cost_sheet_number="CS-00004",
            bom_header_id="bom-1",
            revision_number=1,
            status="DRAFT",
            grand_total_cost=Decimal("500.00"),
            is_deleted=False
        )
        lines = [CostSheetLine(id="line-x", item_type="MATERIAL", base_rate=10, raw_quantity=50, waste_modifier=1.0)]
        
        m_exec_header = MagicMock()
        m_exec_header.scalars().first.return_value = header
        
        m_exec_lines = MagicMock()
        m_exec_lines.scalars().all.return_value = lines
        
        db.execute.side_effect = [m_exec_header, m_exec_lines]
        
        locked_sheet = await CostSheetService.lock_cost_sheet(db, "cs-to-lock")
        
        self.assertEqual(locked_sheet.status, "LOCKED")
        self.assertTrue(db.add.called)
        # Check that we committed the locked state and snapshot
        self.assertTrue(db.commit.called)

    async def test_supersede_locked_sheet(self):
        """Lifecycle test: superseding a LOCKED sheet transitions its status to SUPERSEDED successfully."""
        db = AsyncMock()
        
        header = CostSheetHeader(
            id="cs-to-supersede",
            cost_sheet_number="CS-00005",
            bom_header_id="bom-1",
            revision_number=1,
            status="LOCKED",
            is_deleted=False
        )
        
        m_exec = MagicMock()
        m_exec.scalars().first.return_value = header
        db.execute.return_value = m_exec
        
        superseded_sheet = await CostSheetService.supersede_cost_sheet(db, "cs-to-supersede")
        
        self.assertEqual(superseded_sheet.status, "SUPERSEDED")
        self.assertTrue(db.commit.called)
