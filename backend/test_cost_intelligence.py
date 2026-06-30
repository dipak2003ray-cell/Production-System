import unittest
from unittest.mock import AsyncMock, MagicMock
import json
from decimal import Decimal

from backend.app.api.cost_intelligence import (
    CostSimulationRequest,
    post_cost_simulation,
    get_cost_analysis,
    get_cost_traceability,
    get_cost_explorer,
    get_cost_impact
)
from backend.app.models.cost_sheet import CostSheetHeader, CostSheetLine


class TestCostIntelligence(unittest.IsolatedAsyncioTestCase):

    async def test_scenario_1_material_rate_simulation(self):
        """
        Scenario 1:
        Material Cost = ₹10,000
        Increase Material Rate 10%
        Verify simulated cost changes correctly.
        """
        db = AsyncMock()

        # Mock a Cost Sheet Header with material cost ₹10,000
        mock_header = CostSheetHeader(
            id="cs-test-1",
            bom_header_id="bom-test-1",
            cost_sheet_number="CS-TEST-1",
            total_material_cost=Decimal("10000.00"),
            total_process_cost=Decimal("0.00"),
            total_scrap_credit=Decimal("0.00"),
            total_overhead_cost=Decimal("0.00"),
            grand_total_cost=Decimal("10000.00")
        )

        mock_execute = AsyncMock()
        mock_execute.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_header)))
        db.execute = mock_execute

        # Mocking empty CostSheetLine list
        db.execute.return_value.scalars.return_value.all.return_value = []

        req = CostSimulationRequest(
            cost_sheet_id="cs-test-1",
            material_rate_change_pct=10.0  # +10%
        )

        # Execute simulation
        # Note: we pass dummy auth dictionary because it's a depends
        res = await post_cost_simulation(req, db=db, auth={})

        self.assertEqual(res.original_material_cost, 10000.0)
        self.assertEqual(res.simulated_material_cost, 11000.0)
        self.assertEqual(res.variance_absolute, 1000.0)
        self.assertEqual(res.variance_percentage, 10.0)
        self.assertEqual(len(res.impacts), 1)
        self.assertEqual(res.impacts[0]["factor"], "Material Rate +10.0%")

    async def test_scenario_2_process_rate_simulation_and_impact(self):
        """
        Scenario 2:
        Process Cost = ₹5,000
        Increase Process Rate 20%
        Verify impact calculations.
        """
        db = AsyncMock()

        # Mock a Cost Sheet Header with process cost ₹5,000
        mock_header = CostSheetHeader(
            id="cs-test-2",
            bom_header_id="bom-test-2",
            cost_sheet_number="CS-TEST-2",
            total_material_cost=Decimal("10000.00"),
            total_process_cost=Decimal("5000.00"),
            total_scrap_credit=Decimal("0.00"),
            total_overhead_cost=Decimal("0.00"),
            grand_total_cost=Decimal("15000.00")
        )

        mock_scalars = MagicMock()
        mock_scalars.first.return_value = mock_header
        mock_scalars.all.return_value = []  # No lines
        mock_execute = AsyncMock()
        mock_execute.scalars.return_value = mock_scalars
        db.execute = mock_execute

        req = CostSimulationRequest(
            cost_sheet_id="cs-test-2",
            process_rate_change_pct=20.0  # +20%
        )

        res = await post_cost_simulation(req, db=db, auth={})

        self.assertEqual(res.original_process_cost, 5000.0)
        self.assertEqual(res.simulated_process_cost, 6000.0)
        # Process cost change = +1000
        # Grand total goes from 15000 to 16000 (+6.67%)
        self.assertEqual(res.simulated_grand_total, 16000.0)
        self.assertAlmostEqual(res.variance_percentage, 6.67, places=2)

    async def test_scenario_3_historical_cost_sheet_remains_unmodified(self):
        """
        Scenario 3:
        Simulation must not modify original cost sheet in database.
        """
        db = AsyncMock()

        mock_header = CostSheetHeader(
            id="cs-test-3",
            bom_header_id="bom-test-3",
            cost_sheet_number="CS-TEST-3",
            total_material_cost=Decimal("5000.00"),
            total_process_cost=Decimal("5000.00"),
            total_scrap_credit=Decimal("0.00"),
            total_overhead_cost=Decimal("0.00"),
            grand_total_cost=Decimal("10000.00")
        )

        mock_scalars = MagicMock()
        mock_scalars.first.return_value = mock_header
        mock_scalars.all.return_value = []
        mock_execute = AsyncMock()
        mock_execute.scalars.return_value = mock_scalars
        db.execute = mock_execute

        req = CostSimulationRequest(
            cost_sheet_id="cs-test-3",
            material_rate_change_pct=50.0
        )

        res = await post_cost_simulation(req, db=db, auth={})

        # Verify output is simulated but model was not saved or updated in DB
        self.assertEqual(res.simulated_material_cost, 7500.0)
        self.assertEqual(float(mock_header.total_material_cost), 5000.0)
        self.assertEqual(float(mock_header.grand_total_cost), 10000.0)
        db.commit.assert_not_called()

    async def test_scenario_4_traceability_and_explorer(self):
        """
        Scenario 4:
        Traceability and Explorer Tree building.
        Verify all cost components trace back to source.
        """
        db = AsyncMock()

        mock_header = CostSheetHeader(
            id="cs-test-4",
            bom_header_id="bom-test-4",
            cost_sheet_number="CS-TEST-4",
            total_material_cost=Decimal("2000.00"),
            total_process_cost=Decimal("1000.00"),
            total_scrap_credit=Decimal("200.00"),
            total_overhead_cost=Decimal("300.00"),
            grand_total_cost=Decimal("3100.00")
        )

        # Add lines
        line_mat = CostSheetLine(
            id="line-m-1",
            cost_sheet_header_id="cs-test-4",
            bom_line_id="bom-m-1",
            parent_cost_line_id=None,
            item_type="MATERIAL",
            base_rate=Decimal("10.00"),
            raw_quantity=Decimal("200.00"),
            waste_modifier=Decimal("1.00"),
            calculated_subtotal=Decimal("2000.00"),
            audit_trail_json=json.dumps({"code": "STEEL-01", "explanation": "Steel Plates Lookup successful"})
        )

        line_proc = CostSheetLine(
            id="line-p-1",
            cost_sheet_header_id="cs-test-4",
            bom_line_id="bom-p-1",
            parent_cost_line_id=None,
            item_type="PROCESS",
            base_rate=Decimal("50.00"),
            raw_quantity=Decimal("20.00"),
            waste_modifier=Decimal("1.00"),
            calculated_subtotal=Decimal("1000.00"),
            audit_trail_json=json.dumps({"code": "WELD-01", "explanation": "Welding process setup matched"})
        )

        mock_scalars = MagicMock()
        # Side effect for first call (header) and subsequent calls (lines)
        mock_scalars.first.side_effect = [mock_header, mock_header]
        mock_scalars.all.return_value = [line_mat, line_proc]
        
        mock_execute = AsyncMock()
        mock_execute.scalars.return_value = mock_scalars
        db.execute = mock_execute

        # 1. Test explorer hierarchy
        explorer_res = await get_cost_explorer(cost_sheet_id="cs-test-4", db=db, auth={})
        self.assertEqual(explorer_res.name, "CS-TEST-4")
        self.assertEqual(len(explorer_res.children), 2)
        self.assertEqual(explorer_res.children[0].item_type, "MATERIAL")
        self.assertEqual(explorer_res.children[1].item_type, "PROCESS")

        # 2. Test Traceability Details
        trace_res = await get_cost_traceability(cost_sheet_id="cs-test-4", db=db, auth={})
        self.assertEqual(len(trace_res.materials), 1)
        self.assertEqual(trace_res.materials[0].code, "STEEL-01")
        self.assertEqual(trace_res.materials[0].final_cost, 2000.0)
        self.assertEqual(len(trace_res.processes), 1)
        self.assertEqual(trace_res.processes[0].code, "WELD-01")

    async def test_scenario_5_breakdown_percentages_sum_to_100(self):
        """
        Scenario 5:
        Verify breakdown percentages sum up to 100% correctly.
        """
        db = AsyncMock()

        mock_header = CostSheetHeader(
            id="cs-test-5",
            bom_header_id="bom-test-5",
            cost_sheet_number="CS-TEST-5",
            total_material_cost=Decimal("5000.00"),
            total_process_cost=Decimal("3000.00"),
            total_scrap_credit=Decimal("500.00"),
            total_overhead_cost=Decimal("1000.00"),
            grand_total_cost=Decimal("8500.00")
        )

        # Mock query return
        mock_scalars = MagicMock()
        mock_scalars.first.return_value = mock_header
        mock_scalars.all.return_value = []
        mock_execute = AsyncMock()
        mock_execute.scalars.return_value = mock_scalars
        db.execute = mock_execute

        analysis_res = await get_cost_analysis(cost_sheet_id="cs-test-5", db=db, auth={})
        
        # Breakdown sum should be 100% when adding material, process, overhead, sub assembly and subtracting scrap credit (or checking component contribution)
        total_pct = analysis_res.material_pct + analysis_res.process_pct - analysis_res.scrap_credit_pct + analysis_res.overhead_pct + analysis_res.sub_assembly_pct
        self.assertAlmostEqual(total_pct, 100.0, places=1)
