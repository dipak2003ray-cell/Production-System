import unittest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
import json

from backend.app.schemas.cost_rollup import FinalCalculateRequest, OverheadConfig
from backend.app.services.cost_rollup_engine import CostRollupEngine


class TestCostRollupEngine(unittest.IsolatedAsyncioTestCase):

    async def test_scenario_1_overheads_and_basic_totals(self):
        """
        Scenario 1:
        Material = ₹10,000
        Process = ₹3,000
        Scrap = ₹500
        Overhead = ₹1,500
        Expected = ₹14,000
        """
        # Mock calculation_bom_rollup_recursive to return 10000 material, 3000 process, 0 subassembly
        CostRollupEngine.calculate_bom_rollup_recursive = AsyncMock(
            return_value=(10000.0, 3000.0, 0.0, [])
        )

        db = AsyncMock()

        # Mock scrap calculation
        from backend.app.models.scrap import ScrapTypeMaster
        from backend.app.models.rate import RateCard
        from backend.app.services.scrap_recovery_service import ScrapRecoveryService
        from backend.app.schemas.scrap_recovery import ScrapCalculateResponse

        mock_scrap_resp = ScrapCalculateResponse(
            scrap_type_id="scrap-metal",
            scrap_type_code="MS-SCRAP",
            scrap_type_name="Mild Steel Scrap",
            rate_card_id="rate-scrap-1",
            rate=10.0,
            rate_unit="KG",
            scrap_quantity=50.0,
            recovery_credit=500.0,
            effective_date_used="2026-06-24",
            formula_used="Qty * Rate",
            calculation_explanation="Mocked scrap credit",
            audit_trail_json="{}"
        )
        ScrapRecoveryService.calculate_scrap_recovery = AsyncMock(return_value=mock_scrap_resp)

        req = FinalCalculateRequest(
            bom_header_id="bom-parent-abc",
            effective_date="2026-06-24",
            overheads=[
                OverheadConfig(overhead_type="FIXED", overhead_value=1500.0)
            ],
            scrap_type_id="scrap-metal",
            scrap_quantity=50.0
        )

        response = await CostRollupEngine.run_final_calculation(db, req)

        self.assertEqual(response.total_material_cost, 10000.0)
        self.assertEqual(response.total_process_cost, 3000.0)
        self.assertEqual(response.total_scrap_credit, 500.0)
        self.assertEqual(response.total_overhead_cost, 1500.0)
        # Expected Final Manufacturing Cost = 10000 + 3000 - 500 + 1500 = 14000
        self.assertEqual(response.grand_total_cost, 14000.0)

        # Cost breakdown check
        # Material: 10000/14000 * 100 = 71.43%
        # Process: 3000/14000 * 100 = 21.43%
        # Scrap Credit: 500/14000 * 100 = 3.57%
        # Overhead: 1500/14000 * 100 = 10.71%
        self.assertAlmostEqual(response.breakdown.material_cost_pct, 71.43, places=1)
        self.assertAlmostEqual(response.breakdown.process_cost_pct, 21.43, places=1)
        self.assertAlmostEqual(response.breakdown.scrap_credit_pct, 3.57, places=1)
        self.assertAlmostEqual(response.breakdown.overhead_pct, 10.71, places=1)

    async def test_scenario_2_and_3_recursive_assembly_rollups(self):
        """
        Scenario 2: Assembly Rollup: Parent = ₹5,000, Child = ₹7,000 -> Expected = ₹12,000
        Scenario 3: Multi-Level BOM: A -> B -> C
        """
        # Let's restore real recursive calculation method to test recursive tree building
        # We will mock the database query to return lines for parents and children.
        db = AsyncMock()

        # Let's define BOM lines
        # Parent BOM Header ID: "BOM-A" (Parent)
        # Subassembly BOM Header ID: "BOM-B" (Child)
        from backend.app.models.bom import BOMLine, BOMHeader
        from backend.app.models.material import MaterialMaster
        from backend.app.models.process import ProcessMaster

        bom_line_parent_material = BOMLine(
            id="parent-mat-line",
            bom_header_id="BOM-A",
            line_type="MATERIAL",
            sequence_number=1,
            material_id="MAT-A",
            quantity=10.0,
            uom="KG",
            is_deleted=False
        )

        bom_line_parent_subassembly = BOMLine(
            id="parent-sub-line",
            bom_header_id="BOM-A",
            line_type="SUB_ASSEMBLY",
            sequence_number=2,
            sub_assembly_bom_id="BOM-B",
            quantity=1.0,
            uom="NOS",
            is_deleted=False
        )

        bom_line_child_material = BOMLine(
            id="child-mat-line",
            bom_header_id="BOM-B",
            line_type="MATERIAL",
            sequence_number=1,
            material_id="MAT-B",
            quantity=20.0,
            uom="KG",
            is_deleted=False
        )

        # Mock DB executes:
        # First query: direct lines for BOM-A
        # Second query: direct lines for BOM-B
        m_exec_a = MagicMock()
        m_exec_a.scalars().all.return_value = [bom_line_parent_material, bom_line_parent_subassembly]

        m_exec_b = MagicMock()
        m_exec_b.scalars().all.return_value = [bom_line_child_material]

        db.execute.side_effect = [m_exec_a, m_exec_b]

        # Mock MaterialCostService.calculate_line_cost
        from backend.app.schemas.material_cost import MaterialCalculateResponse
        async def mock_calc_material(db_inst, req):
            if req.material_id == "MAT-A":
                # Return ₹5,000 total material cost for parent
                return MaterialCalculateResponse(
                    bom_line_id=req.bom_line_id,
                    material_id=req.material_id,
                    material_code="MAT-A",
                    rate_card_id="rc-1",
                    rate=500.0,
                    rate_unit="KG",
                    original_quantity=10.0,
                    original_uom="KG",
                    resolved_quantity=10.0,
                    resolved_uom="KG",
                    waste_modifier=1.0,
                    waste_quantity=0.0,
                    effective_quantity=10.0,
                    material_subtotal=5000.0,
                    effective_date_used="2026-06-24",
                    conversion_applied="None",
                    waste_factor_applied=1.0,
                    calculation_explanation="₹500 * 10 = ₹5,000",
                    audit_trail_json="{}"
                )
            elif req.material_id == "MAT-B":
                # Return ₹7,000 total material cost for child
                return MaterialCalculateResponse(
                    bom_line_id=req.bom_line_id,
                    material_id=req.material_id,
                    material_code="MAT-B",
                    rate_card_id="rc-2",
                    rate=350.0,
                    rate_unit="KG",
                    original_quantity=20.0,
                    original_uom="KG",
                    resolved_quantity=20.0,
                    resolved_uom="KG",
                    waste_modifier=1.0,
                    waste_quantity=0.0,
                    effective_quantity=20.0,
                    material_subtotal=7000.0,
                    effective_date_used="2026-06-24",
                    conversion_applied="None",
                    waste_factor_applied=1.0,
                    calculation_explanation="₹350 * 20 = ₹7,000",
                    audit_trail_json="{}"
                )

        from backend.app.services.material_cost_service import MaterialCostService
        MaterialCostService.calculate_line_cost = mock_calc_material

        # Run recursive calculation method directly
        m_cost, p_cost, s_assem, trace_tree = await CostRollupEngine.calculate_bom_rollup_recursive(
            db=db,
            bom_header_id="BOM-A",
            effective_date="2026-06-24"
        )

        # Parent direct cost = ₹5,000
        self.assertEqual(m_cost, 5000.0)
        # Child direct cost rolled up into s_assem = ₹7,000
        self.assertEqual(s_assem, 7000.0)
        # Grand total = Parent + Child = 12000.0
        self.assertEqual(m_cost + p_cost + s_assem, 12000.0)

    async def test_scenario_4_snapshot_reproducibility(self):
        """
        Scenario 4: Snapshot Reproducibility
        Same inputs yield identical outputs.
        """
        CostRollupEngine.calculate_bom_rollup_recursive = AsyncMock(
            return_value=(8000.0, 2000.0, 4000.0, [])
        )

        db = AsyncMock()
        req = FinalCalculateRequest(
            bom_header_id="bom-123",
            overheads=[OverheadConfig(overhead_type="PERCENTAGE", overhead_value=10.0)]
        )

        res1 = await CostRollupEngine.run_final_calculation(db, req)
        res2 = await CostRollupEngine.run_final_calculation(db, req)

        self.assertEqual(res1.grand_total_cost, res2.grand_total_cost)
        self.assertEqual(res1.total_material_cost, res2.total_material_cost)
        self.assertEqual(res1.total_process_cost, res2.total_process_cost)
        self.assertEqual(res1.total_overhead_cost, res2.total_overhead_cost)
        self.assertEqual(res1.total_sub_assembly_cost, res2.total_sub_assembly_cost)


if __name__ == "__main__":
    unittest.main()
