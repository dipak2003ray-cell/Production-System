import uuid
from datetime import datetime
from typing import List, Optional, Dict
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.cost_sheet import CostSheetHeader, CostSheetLine, CostCalculationSnapshot
from ..schemas.cost_sheet import CostSheetHeaderCreate, CostSheetHeaderUpdate

class CostSheetService:

    @classmethod
    async def create_cost_sheet(
        cls, db: AsyncSession, payload: CostSheetHeaderCreate, creator_email: str = None
    ) -> CostSheetHeader:
        # Generate cost sheet number, e.g. "CS-YYYYMMDD-XXXX"
        date_str = datetime.utcnow().strftime("%Y%m%d")
        rand_str = str(uuid.uuid4())[:6].upper()
        cost_sheet_number = f"CS-{date_str}-{rand_str}"

        cost_sheet = CostSheetHeader(
            cost_sheet_number=cost_sheet_number,
            bom_header_id=payload.bom_header_id,
            revision_number=payload.revision_number,
            status=payload.status or "DRAFT",
            total_material_cost=payload.total_material_cost,
            total_process_cost=payload.total_process_cost,
            total_scrap_credit=payload.total_scrap_credit,
            total_overhead_cost=payload.total_overhead_cost,
            grand_total_cost=payload.grand_total_cost,
            created_by=creator_email
        )
        db.add(cost_sheet)
        await db.flush() # Gain cost_sheet.id

        # Insert lines with old_id -> new_id tracking
        if payload.lines:
            temp_id_mapping: Dict[str, str] = {}
            line_instances: List[CostSheetLine] = []

            # Pass 1: Generate real DB IDs and instantiate records
            for line_data in payload.lines:
                new_id = str(uuid.uuid4())
                if line_data.id:
                    temp_id_mapping[line_data.id] = new_id
                
                db_line = CostSheetLine(
                    id=new_id,
                    cost_sheet_header_id=cost_sheet.id,
                    bom_line_id=line_data.bom_line_id,
                    parent_cost_line_id=line_data.parent_cost_line_id, # placeholder
                    item_type=line_data.item_type,
                    base_rate=line_data.base_rate,
                    raw_quantity=line_data.raw_quantity,
                    waste_modifier=line_data.waste_modifier,
                    calculated_subtotal=line_data.calculated_subtotal,
                    audit_trail_json=line_data.audit_trail_json
                )
                db.add(db_line)
                line_instances.append(db_line)

            # Pass 2: Translate parent_cost_line_id pointers using the map
            for db_line in line_instances:
                if db_line.parent_cost_line_id and db_line.parent_cost_line_id in temp_id_mapping:
                    db_line.parent_cost_line_id = temp_id_mapping[db_line.parent_cost_line_id]

        # Also create a default calculation snapshot
        snapshot = CostCalculationSnapshot(
            cost_sheet_header_id=cost_sheet.id,
            formula_constants_snapshot_json="{}",
            rate_card_snapshot_json="{}",
            computational_log="Initial snapshot generated on draft creation."
        )
        db.add(snapshot)

        await db.commit()
        return await cls.get_cost_sheet(db, cost_sheet.id)

    @classmethod
    async def update_cost_sheet(
        cls, db: AsyncSession, cost_sheet_id: str, payload: CostSheetHeaderUpdate
    ) -> CostSheetHeader:
        # Load cost sheet with lines
        cost_sheet = await cls.get_cost_sheet(db, cost_sheet_id)
        if not cost_sheet:
            raise ValueError("Cost Sheet not found.")

        if cost_sheet.status in ["LOCKED", "SUPERSEDED"]:
            raise ValueError(f"Cannot edit a Cost Sheet in {cost_sheet.status} status.")

        # Update scalars
        if payload.status is not None:
            cost_sheet.status = payload.status
        if payload.total_material_cost is not None:
            cost_sheet.total_material_cost = payload.total_material_cost
        if payload.total_process_cost is not None:
            cost_sheet.total_process_cost = payload.total_process_cost
        if payload.total_scrap_credit is not None:
            cost_sheet.total_scrap_credit = payload.total_scrap_credit
        if payload.total_overhead_cost is not None:
            cost_sheet.total_overhead_cost = payload.total_overhead_cost
        if payload.grand_total_cost is not None:
            cost_sheet.grand_total_cost = payload.grand_total_cost

        # Update lines: standard draft rebuild pattern utilizing translation map
        if payload.lines is not None:
            # Delete old lines
            delete_stmt = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
            old_lines_res = await db.execute(delete_stmt)
            for old_line in old_lines_res.scalars().all():
                await db.delete(old_line)
            await db.flush()

            temp_id_mapping: Dict[str, str] = {}
            line_instances: List[CostSheetLine] = []

            # Pass 1: generate database IDs and instantiate
            for line_data in payload.lines:
                new_id = str(uuid.uuid4())
                if line_data.id:
                    temp_id_mapping[line_data.id] = new_id
                
                db_line = CostSheetLine(
                    id=new_id,
                    cost_sheet_header_id=cost_sheet.id,
                    bom_line_id=line_data.bom_line_id,
                    parent_cost_line_id=line_data.parent_cost_line_id,
                    item_type=line_data.item_type,
                    base_rate=line_data.base_rate,
                    raw_quantity=line_data.raw_quantity,
                    waste_modifier=line_data.waste_modifier,
                    calculated_subtotal=line_data.calculated_subtotal,
                    audit_trail_json=line_data.audit_trail_json
                )
                db.add(db_line)
                line_instances.append(db_line)

            # Pass 2: map parent references
            for db_line in line_instances:
                if db_line.parent_cost_line_id and db_line.parent_cost_line_id in temp_id_mapping:
                    db_line.parent_cost_line_id = temp_id_mapping[db_line.parent_cost_line_id]

        await db.commit()
        return await cls.get_cost_sheet(db, cost_sheet_id)

    @classmethod
    async def lock_cost_sheet(cls, db: AsyncSession, cost_sheet_id: str) -> CostSheetHeader:
        cost_sheet = await cls.get_cost_sheet(db, cost_sheet_id)
        if not cost_sheet:
            raise ValueError("Cost Sheet not found.")
        
        if cost_sheet.status not in ["DRAFT", "CALCULATED"]:
            raise ValueError(f"Cannot lock Cost Sheet in status: {cost_sheet.status}")

        cost_sheet.status = "LOCKED"
        db.add(cost_sheet)

        # Freeze Snapshot details
        snapshot = CostCalculationSnapshot(
            cost_sheet_header_id=cost_sheet.id,
            formula_constants_snapshot_json="{\"fixed_overhead_multiplier\": 1.15}",
            rate_card_snapshot_json="[]",
            computational_log=f"Cost Sheet locked on {datetime.utcnow().isoformat()}"
        )
        db.add(snapshot)

        await db.commit()
        return cost_sheet

    @classmethod
    async def supersede_cost_sheet(cls, db: AsyncSession, cost_sheet_id: str) -> CostSheetHeader:
        cost_sheet = await cls.get_cost_sheet(db, cost_sheet_id)
        if not cost_sheet:
            raise ValueError("Cost Sheet not found.")

        cost_sheet.status = "SUPERSEDED"
        db.add(cost_sheet)
        await db.commit()
        return cost_sheet

    @classmethod
    async def get_cost_sheet(cls, db: AsyncSession, cost_sheet_id: str) -> Optional[CostSheetHeader]:
        stmt = (
            select(CostSheetHeader)
            .filter(CostSheetHeader.id == cost_sheet_id, CostSheetHeader.is_deleted == False)
            .options(selectinload(CostSheetHeader.lines))
        )
        res = await db.execute(stmt)
        return res.scalars().first()

    @classmethod
    async def get_cost_sheets(cls, db: AsyncSession) -> List[CostSheetHeader]:
        stmt = (
            select(CostSheetHeader)
            .filter(CostSheetHeader.is_deleted == False)
            .options(selectinload(CostSheetHeader.lines))
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @classmethod
    async def get_snapshot(cls, db: AsyncSession, cost_sheet_id: str) -> Optional[CostCalculationSnapshot]:
        stmt = (
            select(CostCalculationSnapshot)
            .filter(CostCalculationSnapshot.cost_sheet_header_id == cost_sheet_id)
            .order_by(CostCalculationSnapshot.created_at.desc())
        )
        res = await db.execute(stmt)
        return res.scalars().first()
