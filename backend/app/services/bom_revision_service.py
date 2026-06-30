from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Optional
from ..models.bom import BOMHeader, BOMLine
from .bom_validation_service import BOMValidationService

class BOMRevisionService:

    @classmethod
    async def release_bom(cls, db: AsyncSession, bom_header_id: str, operator_email: str = None) -> BOMHeader:
        """
        Locks a draft BOM, validates it first, sets its status to RELEASED,
        and transitions any previous RELEASED versions of the same part number to SUPERSEDED.
        """
        # Load the BOM Header
        stmt_h = select(BOMHeader).filter(BOMHeader.id == bom_header_id, BOMHeader.is_deleted == False)
        res_h = await db.execute(stmt_h)
        bom = res_h.scalars().first()
        if not bom:
            raise ValueError("BOM Header not found.")

        if bom.status == "RELEASED":
            return bom # Already released

        if bom.status == "SUPERSEDED":
            raise ValueError("Superseded BOMs cannot be released.")

        # Trigger strict validation before release
        validation = await BOMValidationService.validate_bom(db, bom_header_id)
        if not validation.is_valid:
            error_msgs = "; ".join([e.message for e in validation.errors])
            raise ValueError(f"BOM Validation failed. Cannot release: {error_msgs}")

        # Supersede any previous released revisions for this part number
        supersede_stmt = select(BOMHeader).filter(
            BOMHeader.part_number == bom.part_number,
            BOMHeader.status == "RELEASED",
            BOMHeader.id != bom.id,
            BOMHeader.is_deleted == False
        )
        res_sup = await db.execute(supersede_stmt)
        previous_released_boms = res_sup.scalars().all()
        
        for old_bom in previous_released_boms:
            old_bom.status = "SUPERSEDED"
            db.add(old_bom)

        # Transition this BOM to RELEASED
        bom.status = "RELEASED"
        db.add(bom)
        
        await db.commit()
        await db.refresh(bom)
        return bom

    @classmethod
    async def create_new_revision(cls, db: AsyncSession, bom_header_id: str, operator_email: str = None) -> BOMHeader:
        """
        Resolves a released BOM and duplicates it into a new revision incremental row in status DRAFT.
        Rewrites parent-to-child references perfectly during copying.
        """
        # Load source BOM
        stmt_h = select(BOMHeader).filter(BOMHeader.id == bom_header_id, BOMHeader.is_deleted == False)
        res_h = await db.execute(stmt_h)
        source_bom = res_h.scalars().first()
        if not source_bom:
            raise ValueError("Source BOM Header not found.")

        if source_bom.status != "RELEASED":
            raise ValueError(f"Only RELEASED BOM headers can be revision incremented. Current is {source_bom.status}.")

        # Determine next revision number by looking at the maximum revision number for this part_number
        stmt_max = select(BOMHeader.revision_number).filter(
            BOMHeader.part_number == source_bom.part_number,
            BOMHeader.is_deleted == False
        ).order_by(BOMHeader.revision_number.desc())
        res_max = await db.execute(stmt_max)
        max_rev = res_max.scalars().first() or source_bom.revision_number
        next_revision = max_rev + 1

        # Create new BOM Header in DRAFT
        new_header = BOMHeader(
            part_number=source_bom.part_number,
            revision_number=next_revision,
            customer_id=source_bom.customer_id,
            description=source_bom.description,
            status="DRAFT",
            is_active=True,
            created_by=operator_email or source_bom.created_by
        )
        
        db.add(new_header)
        await db.flush() # Flush to generate new_header.id
        
        # Load all lines of the source BOM
        stmt_lines = select(BOMLine).filter(
            BOMLine.bom_header_id == source_bom.id,
            BOMLine.is_deleted == False
        ).order_by(BOMLine.parent_bom_line_id.nullsfirst(), BOMLine.sequence_number)
        res_lines = await db.execute(stmt_lines)
        source_lines = res_lines.scalars().all()

        # Dictionary to track old line IDs to new cloned line IDs
        id_mapping: Dict[str, str] = {}
        
        # Clone each line
        cloned_lines = []
        for line in source_lines:
            new_line = BOMLine(
                bom_header_id=new_header.id,
                line_type=line.line_type,
                sequence_number=line.sequence_number,
                material_id=line.material_id,
                process_id=line.process_id,
                sub_assembly_bom_id=line.sub_assembly_bom_id,
                description=line.description,
                quantity=line.quantity,
                uom=line.uom,
                remarks=line.remarks
            )
            db.add(new_line)
            cloned_lines.append((line.id, new_line, line.parent_bom_line_id))
            
        await db.flush() # Flush to populate new_line.id
        
        # Populate the dictionary with generated line keys
        for old_id, new_line_obj, _ in cloned_lines:
            id_mapping[old_id] = new_line_obj.id

        # Update parent_bom_line_id references using the mapping
        for _, new_line_obj, old_parent_id in cloned_lines:
            if old_parent_id:
                new_line_obj.parent_bom_line_id = id_mapping.get(old_parent_id)
                db.add(new_line_obj)

        await db.commit()
        await db.refresh(new_header)
        return new_header
