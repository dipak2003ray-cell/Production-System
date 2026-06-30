from datetime import datetime
import uuid
from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from backend.app.models.estimate import Estimate, EstimateWorkflowHistory
from backend.app.models.bom import BOMHeader, BOMLine
from backend.app.models.cost_sheet import CostSheetHeader, CostSheetLine

ALLOWED_TRANSITIONS = {
    "DRAFT": ["UNDER_REVIEW"],
    "UNDER_REVIEW": ["APPROVED", "CHANGES_REQUESTED"],
    "CHANGES_REQUESTED": ["UNDER_REVIEW"],
    "APPROVED": ["LOCKED", "CHANGES_REQUESTED"],
    "LOCKED": ["SUPERSEDED"],
    "SUPERSEDED": []
}

class EstimateWorkflowService:
    @staticmethod
    async def create_estimate(
        db: AsyncSession,
        description: str,
        cost_sheet_id: Optional[str],
        bom_header_id: Optional[str],
        customer_id: Optional[str],
        revision_notes: Optional[str],
        operator: str
    ) -> Estimate:
        date_str = datetime.utcnow().strftime("%Y%m%d")
        rand_str = uuid.uuid4().hex[:6].upper()
        estimate_number = f"EST-{date_str}-{rand_str}"

        estimate = Estimate(
            id=str(uuid.uuid4()),
            estimate_number=estimate_number,
            description=description or "New Estimate Definition",
            status="DRAFT",
            revision_number=1,
            parent_estimate_id=None,
            previous_revision_id=None,
            is_current_active=True,
            revision_notes=revision_notes or "Initial draft creation",
            revision_timestamp=datetime.utcnow(),
            cost_sheet_id=cost_sheet_id,
            bom_header_id=bom_header_id,
            customer_id=customer_id,
            created_by=operator
        )
        db.add(estimate)
        await db.flush()

        history = EstimateWorkflowHistory(
            id=str(uuid.uuid4()),
            estimate_id=estimate.id,
            from_status="NONE",
            to_status="DRAFT",
            changed_by=operator,
            notes="Estimate created as Draft."
        )
        db.add(history)
        await db.commit()
        await db.refresh(estimate)
        return estimate

    @staticmethod
    async def transition_status(
        db: AsyncSession,
        estimate_id: str,
        target_status: str,
        operator: str,
        notes: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[Estimate]]:
        res = await db.execute(select(Estimate).where(Estimate.id == estimate_id, Estimate.is_deleted == False))
        estimate = res.scalars().first()
        if not estimate:
            return False, "Estimate not found.", None

        current_status = estimate.status
        allowed = ALLOWED_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            return False, f"Transition from state '{current_status}' to '{target_status}' is invalid.", None

        estimate.status = target_status
        estimate.updated_at = datetime.utcnow()

        if target_status == "LOCKED":
            estimate.revision_timestamp = datetime.utcnow()

            # Freeze Cost Sheet
            if estimate.cost_sheet_id:
                await db.execute(
                    update(CostSheetHeader)
                    .where(CostSheetHeader.id == estimate.cost_sheet_id)
                    .values(status="LOCKED", updated_at=datetime.utcnow())
                )
            # Freeze BOM
            if estimate.bom_header_id:
                await db.execute(
                    update(BOMHeader)
                    .where(BOMHeader.id == estimate.bom_header_id)
                    .values(status="RELEASED", updated_at=datetime.utcnow())
                )

        history = EstimateWorkflowHistory(
            id=str(uuid.uuid4()),
            estimate_id=estimate_id,
            from_status=current_status,
            to_status=target_status,
            changed_by=operator,
            notes=notes or f"Transitioned from {current_status} to {target_status}."
        )
        db.add(history)
        await db.commit()
        await db.refresh(estimate)
        return True, None, estimate

    @staticmethod
    async def is_locked(db: AsyncSession, bom_header_id: Optional[str] = None, cost_sheet_id: Optional[str] = None) -> bool:
        if bom_header_id:
            res = await db.execute(select(Estimate).where(Estimate.bom_header_id == bom_header_id, Estimate.status == "LOCKED", Estimate.is_deleted == False))
            if res.scalars().first():
                return True
        if cost_sheet_id:
            res = await db.execute(select(Estimate).where(Estimate.cost_sheet_id == cost_sheet_id, Estimate.status == "LOCKED", Estimate.is_deleted == False))
            if res.scalars().first():
                return True
        return False


class EstimateRevisionService:
    @staticmethod
    async def spawn_revision(
        db: AsyncSession,
        estimate_id: str,
        notes: Optional[str],
        operator: str
    ) -> Tuple[bool, Optional[str], Optional[Estimate]]:
        res = await db.execute(select(Estimate).where(Estimate.id == estimate_id, Estimate.is_deleted == False))
        original = res.scalars().first()
        if not original:
            return False, "Estimate not found.", None

        if original.status not in ["LOCKED", "APPROVED"]:
            return False, "Revisions can only be spawned from LOCKED or APPROVED estimates.", None

        new_bom_id = None
        new_cs_id = None

        # Duplicate BOM
        if original.bom_header_id:
            res_bom = await db.execute(select(BOMHeader).where(BOMHeader.id == original.bom_header_id, BOMHeader.is_deleted == False))
            old_bom = res_bom.scalars().first()
            if old_bom:
                new_bom_id = str(uuid.uuid4())
                new_bom = BOMHeader(
                    id=new_bom_id,
                    part_number=old_bom.part_number,
                    description=old_bom.description,
                    status="DRAFT",
                    revision_number=old_bom.revision_number + 1,
                    customer_id=old_bom.customer_id,
                    created_by=operator
                )
                db.add(new_bom)

                # Duplicate BOM lines
                res_lines = await db.execute(select(BOMLine).where(BOMLine.bom_header_id == old_bom.id, BOMLine.is_deleted == False))
                old_lines = res_lines.scalars().all()
                line_map = {}
                for ol in old_lines:
                    nl_id = str(uuid.uuid4())
                    line_map[ol.id] = nl_id

                for ol in old_lines:
                    new_line = BOMLine(
                        id=line_map[ol.id],
                        bom_header_id=new_bom_id,
                        parent_bom_line_id=line_map.get(ol.parent_bom_line_id) if ol.parent_bom_line_id else None,
                        line_type=ol.line_type,
                        sequence_number=ol.sequence_number,
                        material_id=ol.material_id,
                        process_id=ol.process_id,
                        sub_assembly_bom_id=ol.sub_assembly_bom_id,
                        description=ol.description,
                        quantity=ol.quantity,
                        uom=ol.uom,
                        remarks=ol.remarks
                    )
                    db.add(new_line)

        # Duplicate Cost Sheet
        if original.cost_sheet_id:
            res_cs = await db.execute(select(CostSheetHeader).where(CostSheetHeader.id == original.cost_sheet_id, CostSheetHeader.is_deleted == False))
            old_cs = res_cs.scalars().first()
            if old_cs:
                new_cs_id = str(uuid.uuid4())
                new_cs = CostSheetHeader(
                    id=new_cs_id,
                    bom_header_id=new_bom_id or old_cs.bom_header_id,
                    status="DRAFT",
                    revision_number=old_cs.revision_number + 1,
                    total_material_cost=old_cs.total_material_cost,
                    total_process_cost=old_cs.total_process_cost,
                    total_scrap_credit=old_cs.total_scrap_credit,
                    total_overhead_cost=old_cs.total_overhead_cost,
                    grand_total_cost=old_cs.grand_total_cost,
                    created_by=operator
                )
                db.add(new_cs)

                # Duplicate Cost Sheet lines
                res_cs_lines = await db.execute(select(CostSheetLine).where(CostSheetLine.cost_sheet_header_id == old_cs.id, CostSheetLine.is_deleted == False))
                old_cs_lines = res_cs_lines.scalars().all()
                cs_line_map = {}
                for ocl in old_cs_lines:
                    ncl_id = str(uuid.uuid4())
                    cs_line_map[ocl.id] = ncl_id

                for ocl in old_cs_lines:
                    new_cs_line = CostSheetLine(
                        id=cs_line_map[ocl.id],
                        cost_sheet_header_id=new_cs_id,
                        parent_cost_line_id=cs_line_map.get(ocl.parent_cost_line_id) if ocl.parent_cost_line_id else None,
                        item_type=ocl.item_type,
                        base_rate=ocl.base_rate,
                        raw_quantity=ocl.raw_quantity,
                        waste_modifier=ocl.waste_modifier,
                        calculated_subtotal=ocl.calculated_subtotal,
                        audit_trail_json=ocl.audit_trail_json
                    )
                    db.add(new_cs_line)

        # Deactivate original
        original.is_current_active = False

        # Spawn new estimate
        date_str = datetime.utcnow().strftime("%Y%m%d")
        rand_str = uuid.uuid4().hex[:6].upper()
        estimate_number = f"EST-{date_str}-{rand_str}"
        next_rev = original.revision_number + 1

        new_estimate = Estimate(
            id=str(uuid.uuid4()),
            estimate_number=estimate_number,
            description=original.description,
            status="DRAFT",
            revision_number=next_rev,
            parent_estimate_id=original.parent_estimate_id or original.id,
            previous_revision_id=original.id,
            is_current_active=True,
            revision_notes=notes or f"Revision {next_rev} spawned from {original.estimate_number}.",
            revision_timestamp=datetime.utcnow(),
            cost_sheet_id=new_cs_id,
            bom_header_id=new_bom_id,
            customer_id=original.customer_id,
            created_by=operator
        )
        db.add(new_estimate)
        await db.flush()

        history = EstimateWorkflowHistory(
            id=str(uuid.uuid4()),
            estimate_id=new_estimate.id,
            from_status="NONE",
            to_status="DRAFT",
            changed_by=operator,
            notes=f"Revision {next_rev} spawned from {original.estimate_number}."
        )
        db.add(history)
        await db.commit()
        await db.refresh(new_estimate)
        return True, None, new_estimate
