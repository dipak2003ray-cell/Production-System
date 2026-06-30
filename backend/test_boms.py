import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
import asyncio

# Structures of interest
from backend.app.models.bom import BOMHeader, BOMLine
from backend.app.models.material import MaterialMaster
from backend.app.models.process import ProcessMaster
from backend.app.services.bom_validation_service import BOMValidationService
from backend.app.services.bom_revision_service import BOMRevisionService
from backend.app.services.bom_tree_service import BOMTreeService


class TestBOMValidation(unittest.IsolatedAsyncioTestCase):

    async def test_material_line_validation(self):
        """MATERIAL type lines must point to active, non-deleted materials, and have positive quantities."""
        db = AsyncMock()
        
        # 1. Invalid material format: Missing material_id
        bom_header = BOMHeader(id="bom-header-id", part_number="PART-100", status="DRAFT", is_active=True, is_deleted=False)
        bom_line = BOMLine(id="line-1", bom_header_id="bom-header-id", line_type="MATERIAL", sequence_number=1, quantity=Decimal("2.5"), uom="kg", is_deleted=False)
        
        # DB mocks
        db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: bom_header)),  # Header check
            MagicMock(scalars=lambda: MagicMock(all=lambda: [bom_line]))   # Lines check
        ]
        
        res = await BOMValidationService.validate_bom(db, "bom-header-id")
        self.assertFalse(res.is_valid)
        self.assertTrue(any("material master reference" in e.message for e in res.errors))

    async def test_process_line_validation(self):
        """PROCESS lines require valid process refs and positive quantities."""
        db = AsyncMock()
        
        bom_header = BOMHeader(id="bom-header-id", part_number="PART-100", status="DRAFT", is_active=True, is_deleted=False)
        bom_line = BOMLine(id="line-2", bom_header_id="bom-header-id", line_type="PROCESS", sequence_number=1, quantity=Decimal("-0.5"), uom="hours", is_deleted=False)
        
        db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: bom_header)),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [bom_line]))
        ]
        
        res = await BOMValidationService.validate_bom(db, "bom-header-id")
        self.assertFalse(res.is_valid)
        self.assertTrue(any("strictly positive quantity" in e.message for e in res.errors))

    async def test_circular_reference_detection(self):
        """BOM trees must not feature circular dependency loops."""
        db = AsyncMock()
        
        # Create a self-referencing sub-assembly line
        bom_header = BOMHeader(id="bom-1", part_number="PART-1", status="DRAFT", is_active=True, is_deleted=False)
        bom_line = BOMLine(
            id="line-x",
            bom_header_id="bom-1",
            line_type="SUB_ASSEMBLY",
            sequence_number=1,
            sub_assembly_bom_id="bom-1",  # Self reference
            quantity=Decimal("1.0"),
            uom="Pcs",
            is_deleted=False
        )
        
        db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: bom_header)),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [bom_line]))
        ]
        
        res = await BOMValidationService.validate_bom(db, "bom-1")
        self.assertFalse(res.is_valid)
        self.assertTrue(any("direct circular reference" in e.message for e in res.errors))


class TestBOMTreeAndTraversals(unittest.IsolatedAsyncioTestCase):

    async def test_deeply_nested_tree_generation(self):
        """BOM Tree expansion traverses recursively and preserves parent-child relations."""
        db = AsyncMock()
        
        # BOM1 includes nested BOM2
        l1 = BOMLine(id="l1-mat", bom_header_id="bom-1", line_type="MATERIAL", sequence_number=1, quantity=Decimal("10.0"), uom="kg")
        l2 = BOMLine(id="l1-sub", bom_header_id="bom-1", line_type="SUB_ASSEMBLY", sequence_number=2, quantity=Decimal("1.0"), uom="Pcs", sub_assembly_bom_id="bom-2")
        
        # BOM2 lines
        l3 = BOMLine(id="l2-proc", bom_header_id="bom-2", line_type="PROCESS", sequence_number=1, quantity=Decimal("4.0"), uom="hours")
        
        # Mock execution sequences
        m_execute_bom1 = MagicMock()
        m_execute_bom1.scalars().all.return_value = [l1, l2]
        
        m_execute_bom2 = MagicMock()
        m_execute_bom2.scalars().all.return_value = [l3]
        
        # When db.execute is called for bom-1, then bom-2
        db.execute.side_effect = [m_execute_bom1, m_execute_bom2]
        
        roots = await BOMTreeService.get_bom_tree(db, "bom-1")
        
        self.assertEqual(len(roots), 2)
        sub_assembly_node = roots[1]
        self.assertEqual(sub_assembly_node.line_type, "SUB_ASSEMBLY")
        self.assertEqual(len(sub_assembly_node.children), 1)
        self.assertEqual(sub_assembly_node.children[0].line_type, "PROCESS")


class TestBOMRevisionWorkflows(unittest.IsolatedAsyncioTestCase):

    async def test_new_revision_generation_retains_tree_and_creates_draft(self):
        """Incrementing a released BOM creates a DRAFT v+1 with copied lines."""
        db = AsyncMock()
        
        source_bom = BOMHeader(id="bom-rev1", part_number="PART-XP", revision_number=1, status="RELEASED", is_deleted=False)
        line = BOMLine(id="l-old", bom_header_id="bom-rev1", line_type="MATERIAL", sequence_number=10, quantity=Decimal("5.0"), uom="kg", parent_bom_line_id=None, is_deleted=False)
        
        # Mock sequences: 
        # 1. Load source_bom (first)
        execute_source = MagicMock()
        execute_source.scalars().first.return_value = source_bom
        
        # 2. Get maximum revision number
        execute_max = MagicMock()
        execute_max.scalars().first.return_value = 1
        
        # 3. Load source lines
        execute_lines = MagicMock()
        execute_lines.scalars().all.return_value = [line]
        
        db.execute.side_effect = [execute_source, execute_max, execute_lines]
        
        draft_v2 = await BOMRevisionService.create_new_revision(db, "bom-rev1", "operator@ccs.com")
        
        self.assertEqual(draft_v2.part_number, "PART-XP")
        self.assertEqual(draft_v2.revision_number, 2)
        self.assertEqual(draft_v2.status, "DRAFT")


if __name__ == "__main__":
    unittest.main()
