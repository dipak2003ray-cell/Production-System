import json
import uuid
from decimal import Decimal
from datetime import date, datetime
from typing import List, Optional, Set, Dict, Tuple
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.bom import BOMHeader, BOMLine
from ..models.material import MaterialMaster
from ..models.process import ProcessMaster
from ..models.rate import RateCard
from ..models.scrap import ScrapTypeMaster
from ..models.cost_sheet import CostSheetHeader, CostSheetLine, CostCalculationSnapshot

from ..schemas.material_cost import MaterialCalculateRequest
from ..schemas.process_cost import ProcessCalculateRequest
from ..schemas.scrap_recovery import ScrapCalculateRequest
from ..schemas.cost_rollup import (
    OverheadConfig,
    FinalCalculateRequest,
    FinalCalculateResponse,
    CostBreakdownResponse,
    TraceabilityNode
)

from .material_cost_service import MaterialCostService
from .process_cost_service import ProcessCostService
from .scrap_recovery_service import ScrapRecoveryService


class CostRollupEngine:

    @classmethod
    async def calculate_bom_rollup_recursive(
        cls,
        db: AsyncSession,
        bom_header_id: str,
        effective_date: str,
        visited: Set[str] = None
    ) -> Tuple[float, float, float, List[TraceabilityNode]]:
        """
        Recursively rolls up the BOM.
        Returns Tuple of: (material_cost, process_cost, sub_assembly_cost, children_traceability_nodes)
        """
        if visited is None:
            visited = set()

        if bom_header_id in visited:
            # Prevent infinite circular loops
            err_node = TraceabilityNode(
                id=f"err-{bom_header_id}",
                item_type="SUB_ASSEMBLY",
                code="CIRCULAR",
                description="[CIRCULAR DEPENDENCY LOOP DETECTED]",
                quantity=0.0,
                uom="ERR",
                rate=0.0,
                subtotal=0.0,
                explanation=f"Circular dependency loop back to BOM Header {bom_header_id}"
            )
            return 0.0, 0.0, 0.0, [err_node]

        visited.add(bom_header_id)

        # Retrieve direct non-deleted lines of this BOM
        stmt = select(BOMLine).filter(
            BOMLine.bom_header_id == bom_header_id,
            BOMLine.is_deleted == False
        ).order_by(BOMLine.sequence_number)
        res = await db.execute(stmt)
        lines = res.scalars().all()

        material_sum = 0.0
        process_sum = 0.0
        sub_assembly_sum = 0.0
        trace_nodes: List[TraceabilityNode] = []

        for l in lines:
            if l.line_type == "MATERIAL" and l.material_id:
                try:
                    req = MaterialCalculateRequest(
                        bom_line_id=l.id,
                        material_id=l.material_id,
                        quantity=float(l.quantity),
                        uom=l.uom,
                        waste_modifier=1.0,
                        effective_date=effective_date
                    )
                    calc_res = await MaterialCostService.calculate_line_cost(db, req)
                    subtotal = calc_res.material_subtotal
                    material_sum += subtotal

                    node = TraceabilityNode(
                        id=l.id,
                        item_type="MATERIAL",
                        code=calc_res.material_code,
                        description=l.description or f"Material {calc_res.material_code}",
                        quantity=calc_res.original_quantity,
                        uom=calc_res.original_uom,
                        rate=calc_res.rate,
                        waste_modifier=calc_res.waste_modifier,
                        subtotal=subtotal,
                        explanation=calc_res.calculation_explanation
                    )
                    trace_nodes.append(node)
                except Exception as e:
                    # Robust fallback for material if rate lookup fails: use 0 rate but log explanation
                    node = TraceabilityNode(
                        id=l.id,
                        item_type="MATERIAL",
                        code=l.material_id[:8],
                        description=l.description or "Material Error",
                        quantity=float(l.quantity),
                        uom=l.uom,
                        rate=0.0,
                        subtotal=0.0,
                        explanation=f"Material Calculation Failed: {str(e)}"
                    )
                    trace_nodes.append(node)

            elif l.line_type == "PROCESS" and l.process_id:
                # Resolve physical thickness/subtype from remarks or standard defaults
                thickness = 3.0
                sub_type = "MS"
                if l.remarks:
                    import re
                    try:
                        data = json.loads(l.remarks)
                        if "thickness" in data:
                            thickness = float(data["thickness"])
                        if "sub_type" in data:
                            sub_type = str(data["sub_type"])
                    except:
                        thick_match = re.search(r"thickness\s*[:=]\s*([\d\.]+)", l.remarks, re.IGNORECASE)
                        if thick_match:
                            thickness = float(thick_match.group(1))
                        sub_match = re.search(r"sub_type\s*[:=]\s*(\w+)", l.remarks, re.IGNORECASE)
                        if sub_match:
                            sub_type = sub_match.group(1)

                try:
                    req = ProcessCalculateRequest(
                        bom_line_id=l.id,
                        process_id=l.process_id,
                        quantity=float(l.quantity),
                        thickness=thickness,
                        sub_type=sub_type,
                        effective_date=effective_date
                    )
                    calc_res = await ProcessCostService.calculate_line_cost(db, req)
                    subtotal = calc_res.process_cost
                    process_sum += subtotal

                    node = TraceabilityNode(
                        id=l.id,
                        item_type="PROCESS",
                        code=calc_res.process_code,
                        description=l.description or f"Process {calc_res.process_code}",
                        quantity=calc_res.driver_quantity,
                        uom=calc_res.rate_unit,
                        rate=calc_res.rate,
                        subtotal=subtotal,
                        explanation=calc_res.calculation_formula
                    )
                    trace_nodes.append(node)
                except Exception as e:
                    # Try looking up any available rate card for this process
                    try:
                        stmt_rc = select(RateCard).filter(
                            RateCard.process_id == l.process_id,
                            RateCard.is_active == True,
                            RateCard.is_deleted == False
                        )
                        res_rc = await db.execute(stmt_rc)
                        rc = res_rc.scalars().first()
                        if rc:
                            subtotal = float(l.quantity) * float(rc.rate)
                            process_sum += subtotal
                            node = TraceabilityNode(
                                id=l.id,
                                item_type="PROCESS",
                                code=l.process.name if l.process else "Process",
                                description=l.description or "Process Fallback",
                                quantity=float(l.quantity),
                                uom=rc.rate_unit,
                                rate=float(rc.rate),
                                subtotal=subtotal,
                                explanation=f"Fallback active rate matched: {l.quantity} * {rc.rate} = {subtotal}"
                            )
                            trace_nodes.append(node)
                        else:
                            raise ValueError("No active rate cards found.")
                    except:
                        # Fallback with ₹0 rate if everything fails
                        node = TraceabilityNode(
                            id=l.id,
                            item_type="PROCESS",
                            code=l.process_id[:8],
                            description=l.description or "Process Error",
                            quantity=float(l.quantity),
                            uom="units",
                            rate=0.0,
                            subtotal=0.0,
                            explanation=f"Process Cost calculation failed: {str(e)}"
                        )
                        trace_nodes.append(node)

            elif l.line_type == "SUB_ASSEMBLY" and l.sub_assembly_bom_id:
                # Recursively rollup sub assembly
                sub_mat, sub_proc, sub_assem, sub_children = await cls.calculate_bom_rollup_recursive(
                    db=db,
                    bom_header_id=l.sub_assembly_bom_id,
                    effective_date=effective_date,
                    visited=visited.copy()
                )
                # Formula for total cost of sub-assembly is:
                # Material + Process + SubAssembly (scrap/overheads are calculated at header level)
                sub_assembly_unit_cost = sub_mat + sub_proc + sub_assem
                qty_multiplier = float(l.quantity)
                total_sub_cost = sub_assembly_unit_cost * qty_multiplier
                sub_assembly_sum += total_sub_cost

                node = TraceabilityNode(
                    id=l.id,
                    item_type="SUB_ASSEMBLY",
                    code=l.sub_assembly.part_number if l.sub_assembly else "SUB-BOM",
                    description=l.description or f"Sub Assembly {l.sub_assembly_bom_id[:8]}",
                    quantity=qty_multiplier,
                    uom=l.uom,
                    rate=sub_assembly_unit_cost,
                    subtotal=total_sub_cost,
                    explanation=f"Recursive rollup: {qty_multiplier} unit(s) x ₹{sub_assembly_unit_cost:.2f}",
                    children=sub_children
                )
                trace_nodes.append(node)

        return material_sum, process_sum, sub_assembly_sum, trace_nodes

    @classmethod
    async def run_final_calculation(
        cls,
        db: AsyncSession,
        req: FinalCalculateRequest,
        creator_email: str = None
    ) -> FinalCalculateResponse:
        """
        Core engine to calculate material, process, scrap, overhead, and rollups.
        Generates breakdown % and comprehensive traceability tree.
        """
        eff_date = req.effective_date or date.today().isoformat()

        # 1. Run recursive BOM Rollup
        m_cost, p_cost, s_assem_cost, trace_tree = await cls.calculate_bom_rollup_recursive(
            db=db,
            bom_header_id=req.bom_header_id,
            effective_date=eff_date
        )

        # 2. Resolve Scrap Credit
        scrap_credit = 0.0
        if req.scrap_type_id and req.scrap_quantity and req.scrap_quantity > 0:
            try:
                scrap_req = ScrapCalculateRequest(
                    scrap_quantity=req.scrap_quantity,
                    scrap_type=req.scrap_type_id,
                    effective_date=eff_date
                )
                scrap_res = await ScrapRecoveryService.calculate_scrap_recovery(db, scrap_req)
                scrap_credit = scrap_res.recovery_credit

                # Add scrap node to traceability
                scrap_node = TraceabilityNode(
                    id=str(uuid.uuid4()),
                    item_type="SCRAP_RECOVERY",
                    code=scrap_res.scrap_type_code,
                    description=f"Scrap Recovery: {scrap_res.scrap_type_name}",
                    quantity=scrap_res.scrap_quantity,
                    uom=scrap_res.rate_unit,
                    rate=scrap_res.rate,
                    subtotal=scrap_credit,
                    explanation=scrap_res.calculation_explanation
                )
                trace_tree.append(scrap_node)
            except Exception as e:
                # Trace error gracefully
                scrap_node = TraceabilityNode(
                    id=str(uuid.uuid4()),
                    item_type="SCRAP_RECOVERY",
                    code=req.scrap_type_id[:8],
                    description="Scrap Recovery Error",
                    quantity=req.scrap_quantity,
                    uom="KG",
                    rate=0.0,
                    subtotal=0.0,
                    explanation=f"Scrap calculation failed: {str(e)}"
                )
                trace_tree.append(scrap_node)

        # 3. Overhead Engine
        # Apply against Base Cost = Material Cost + Process Cost - Scrap Credit
        base_overhead_cost = m_cost + p_cost - scrap_credit
        overhead_cost = 0.0

        if req.overheads:
            for ov in req.overheads:
                if ov.overhead_type == "PERCENTAGE":
                    ov_val = base_overhead_cost * (ov.overhead_value / 100.0)
                    overhead_cost += ov_val
                    explanation_ov = f"Overhead PERCENTAGE: {ov.overhead_value}% applied against base ₹{base_overhead_cost:.2f} = ₹{ov_val:.2f}"
                else:  # FIXED
                    ov_val = ov.overhead_value
                    overhead_cost += ov_val
                    explanation_ov = f"Overhead FIXED: ₹{ov_val:.2f}"

                ov_node = TraceabilityNode(
                    id=str(uuid.uuid4()),
                    item_type="OVERHEAD",
                    code=ov.overhead_type,
                    description=f"Overhead Burden allocation",
                    quantity=1.0,
                    uom="allocation",
                    rate=ov_val,
                    subtotal=ov_val,
                    explanation=explanation_ov
                )
                trace_tree.append(ov_node)

        # 4. Final Manufacturing Cost Formula:
        # Final Cost = Material + Process - Scrap Credit + Overhead + Sub Assembly
        grand_total = m_cost + p_cost - scrap_credit + overhead_cost + s_assem_cost

        # 5. Cost Breakdown Engine (Percentages)
        denom = grand_total if grand_total > 0 else 1.0
        breakdown = CostBreakdownResponse(
            material_cost_pct=round((m_cost / denom) * 100.0, 2),
            process_cost_pct=round((p_cost / denom) * 100.0, 2),
            scrap_credit_pct=round((scrap_credit / denom) * 100.0, 2),
            overhead_pct=round((overhead_cost / denom) * 100.0, 2),
            sub_assembly_pct=round((s_assem_cost / denom) * 100.0, 2)
        )

        cost_sheet_id = req.cost_sheet_id
        cost_sheet_number = None

        # 6. Save or Update Cost Sheet if header ID provided (Snapshot Engine)
        if cost_sheet_id:
            stmt_cs = select(CostSheetHeader).filter(
                CostSheetHeader.id == cost_sheet_id,
                CostSheetHeader.is_deleted == False
            )
            res_cs = await db.execute(stmt_cs)
            cs_header = res_cs.scalars().first()
            if cs_header:
                if cs_header.status in ["LOCKED", "SUPERSEDED"]:
                    raise ValueError(f"Cannot recalculate/edit a locked or superseded Cost Sheet ({cs_header.status}).")

                # Update the header totals
                cs_header.total_material_cost = Decimal(str(m_cost))
                cs_header.total_process_cost = Decimal(str(p_cost))
                cs_header.total_scrap_credit = Decimal(str(scrap_credit))
                cs_header.total_overhead_cost = Decimal(str(overhead_cost))
                cs_header.grand_total_cost = Decimal(str(grand_total))
                cs_header.status = "CALCULATED"

                cost_sheet_number = cs_header.cost_sheet_number

                # Rebuild lines with parent-child mapping for Traceability
                # Delete existing lines first
                stmt_del = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
                res_del = await db.execute(stmt_del)
                for line in res_del.scalars().all():
                    await db.delete(line)
                await db.flush()

                # Insert tree as flat database rows preserving parent hierarchy
                async def insert_trace_nodes(nodes: List[TraceabilityNode], parent_db_id: str = None):
                    for node in nodes:
                        db_line_id = str(uuid.uuid4())
                        db_line = CostSheetLine(
                            id=db_line_id,
                            cost_sheet_header_id=cs_header.id,
                            bom_line_id=node.id if "-" not in node.id else cs_header.bom_header_id, # Link to source line or fallback
                            parent_cost_line_id=parent_db_id,
                            item_type=node.item_type,
                            base_rate=Decimal(str(node.rate)),
                            raw_quantity=Decimal(str(node.quantity)),
                            waste_modifier=Decimal(str(node.waste_modifier)),
                            calculated_subtotal=Decimal(str(node.subtotal)),
                            audit_trail_json=json.dumps({
                                "code": node.code,
                                "explanation": node.explanation
                            })
                        )
                        db.add(db_line)
                        if node.children:
                            await insert_trace_nodes(node.children, db_line_id)

                await insert_trace_nodes(trace_tree)

                # Extended Snapshot Generation
                snapshot = CostCalculationSnapshot(
                    cost_sheet_header_id=cs_header.id,
                    formula_constants_snapshot_json=json.dumps({
                        "overheads_applied": [ov.model_dump() for ov in req.overheads] if req.overheads else [],
                        "scrap_type_id": req.scrap_type_id,
                        "scrap_quantity": req.scrap_quantity
                    }),
                    rate_card_snapshot_json=json.dumps({
                        "m_cost": m_cost,
                        "p_cost": p_cost,
                        "scrap_credit": scrap_credit,
                        "overhead_cost": overhead_cost,
                        "s_assem_cost": s_assem_cost,
                        "grand_total": grand_total,
                        "breakdown_percentages": breakdown.model_dump()
                    }),
                    computational_log=f"Final calculation completed. grand_total={grand_total:.4f}, calculated_on={datetime.utcnow().isoformat()}"
                )
                db.add(snapshot)

                await db.commit()

        return FinalCalculateResponse(
            cost_sheet_id=cost_sheet_id,
            cost_sheet_number=cost_sheet_number,
            bom_header_id=req.bom_header_id,
            total_material_cost=m_cost,
            total_process_cost=p_cost,
            total_scrap_credit=scrap_credit,
            total_overhead_cost=overhead_cost,
            total_sub_assembly_cost=s_assem_cost,
            grand_total_cost=grand_total,
            breakdown=breakdown,
            traceability_tree=trace_tree
        )
