from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from ..database import get_db
from ..models.bom import BOMHeader, BOMLine
from ..schemas.bom import (
    BOMHeaderCreate,
    BOMHeaderResponse,
    BOMHeaderWithLinesResponse,
    BOMLineResponse,
    BOMValidationResponse,
    BOMTreeNode
)
from ..core.dependencies import get_token_payload
from ..services.bom_validation_service import BOMValidationService
from ..services.bom_revision_service import BOMRevisionService
from ..services.bom_tree_service import BOMTreeService

router = APIRouter(prefix="/boms", tags=["BOM Foundation"])

# Custom Auth check helpers
async def require_estimator_or_admin(payload: dict = Depends(get_token_payload)) -> dict:
    if payload.get("role") not in ["L2-Admin", "L1-Estimator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Required L2-Admin or L1-Estimator security clearance."
        )
    return payload

async def require_any_role(payload: dict = Depends(get_token_payload)) -> dict:
    # L2-Admin, L1-Estimator, PM are allowed
    if payload.get("role") not in ["L2-Admin", "L1-Estimator", "PM"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to registered company roles."
        )
    return payload


@router.get("", response_model=List[BOMHeaderResponse])
async def list_boms(db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    """Retrieve all active BOM Headers (all statuses)."""
    stmt = select(BOMHeader).filter(BOMHeader.is_deleted == False).order_by(BOMHeader.part_number, BOMHeader.revision_number)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{id}", response_model=BOMHeaderWithLinesResponse)
async def get_bom(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    """Retrieve details of a single BOM header accompanied by its line items."""
    stmt_h = select(BOMHeader).filter(BOMHeader.id == id, BOMHeader.is_deleted == False)
    res_h = await db.execute(stmt_h)
    bom = res_h.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM Header not found.")

    stmt_l = select(BOMLine).filter(BOMLine.bom_header_id == id, BOMLine.is_deleted == False).order_by(BOMLine.sequence_number)
    res_l = await db.execute(stmt_l)
    lines = res_l.scalars().all()

    # Cast lists
    response_bom = BOMHeaderWithLinesResponse(
        id=bom.id,
        part_number=bom.part_number,
        revision_number=bom.revision_number,
        customer_id=bom.customer_id,
        description=bom.description,
        status=bom.status,
        is_active=bom.is_active,
        created_by=bom.created_by,
        created_at=bom.created_at,
        updated_at=bom.updated_at,
        lines=[BOMLineResponse.model_validate(l) for l in lines]
    )
    return response_bom


@router.post("", response_model=BOMHeaderWithLinesResponse, status_code=status.HTTP_201_CREATED)
async def create_bom(payload: BOMHeaderCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_estimator_or_admin)):
    """Create a new DRAFT BOM with optional initial line items."""
    # Check for direct duplicates of part_number + revision_number = 1
    stmt_dup = select(BOMHeader).filter(
        BOMHeader.part_number == payload.part_number.strip(),
        BOMHeader.revision_number == 1,
        BOMHeader.is_deleted == False
    )
    res_dup = await db.execute(stmt_dup)
    if res_dup.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"BOM with Part Number [{payload.part_number}] and Revision 1 already exists."
        )

    operator_email = current_user.get("email")

    new_bom = BOMHeader(
        part_number=payload.part_number.strip(),
        revision_number=1,
        customer_id=payload.customer_id,
        description=payload.description.strip() if payload.description else None,
        status="DRAFT",
        is_active=True,
        created_by=operator_email
    )
    db.add(new_bom)
    await db.flush() # Flushing to populate ID

    mapped_lines: List[BOMLine] = []
    # If initial lines are supplied: create them
    if payload.lines:
        import uuid
        temp_id_mapping = {}
        
        # Pass 1: generate IDs and instantiate BOMLines
        for l in payload.lines:
            new_id = str(uuid.uuid4())
            if l.id:
                temp_id_mapping[l.id] = new_id
            else:
                temp_id_mapping[str(l.sequence_number)] = new_id
                
            new_line = BOMLine(
                id=new_id,
                bom_header_id=new_bom.id,
                line_type=l.line_type,
                sequence_number=l.sequence_number,
                material_id=l.material_id,
                process_id=l.process_id,
                sub_assembly_bom_id=l.sub_assembly_bom_id,
                description=l.description,
                quantity=l.quantity,
                uom=l.uom,
                remarks=l.remarks
            )
            db.add(new_line)
            mapped_lines.append(new_line)

        # Pass 2: update parent_bom_line_id using the mapping
        for idx, l in enumerate(payload.lines):
            mapped_line = mapped_lines[idx]
            if l.parent_bom_line_id:
                mapped_line.parent_bom_line_id = temp_id_mapping.get(l.parent_bom_line_id)

    await db.commit()
    await db.refresh(new_bom)

    return BOMHeaderWithLinesResponse(
        id=new_bom.id,
        part_number=new_bom.part_number,
        revision_number=new_bom.revision_number,
        customer_id=new_bom.customer_id,
        description=new_bom.description,
        status=new_bom.status,
        is_active=new_bom.is_active,
        created_by=new_bom.created_by,
        created_at=new_bom.created_at,
        updated_at=new_bom.updated_at,
        lines=[BOMLineResponse.model_validate(l) for l in mapped_lines]
    )


@router.put("/{id}", response_model=BOMHeaderWithLinesResponse)
async def update_bom(id: str, payload: BOMHeaderCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_estimator_or_admin)):
    """Edit a DRAFT BOM header and its line definitions. Locked once RELEASED."""
    stmt_h = select(BOMHeader).filter(BOMHeader.id == id, BOMHeader.is_deleted == False)
    res_h = await db.execute(stmt_h)
    bom = res_h.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM Header not found.")

    if bom.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"BOM cannot be modified; lifecycle status is {bom.status} (locked)."
        )

    # Simple details update
    bom.part_number = payload.part_number.strip()
    bom.customer_id = payload.customer_id
    bom.description = payload.description.strip() if payload.description else None
    db.add(bom)

    # Synchronize lines: Delete existing ones and rebuild
    stmt_del = select(BOMLine).filter(BOMLine.bom_header_id == id)
    res_del = await db.execute(stmt_del)
    for existing_l in res_del.scalars().all():
        await db.delete(existing_l)

    await db.flush()

    mapped_lines: List[BOMLine] = []
    if payload.lines:
        import uuid
        temp_id_mapping = {}
        
        # Pass 1: generate IDs and instantiate BOMLines
        for l in payload.lines:
            new_id = str(uuid.uuid4())
            if l.id:
                temp_id_mapping[l.id] = new_id
            else:
                temp_id_mapping[str(l.sequence_number)] = new_id
                
            new_line = BOMLine(
                id=new_id,
                bom_header_id=bom.id,
                line_type=l.line_type,
                sequence_number=l.sequence_number,
                material_id=l.material_id,
                process_id=l.process_id,
                sub_assembly_bom_id=l.sub_assembly_bom_id,
                description=l.description,
                quantity=l.quantity,
                uom=l.uom,
                remarks=l.remarks
            )
            db.add(new_line)
            mapped_lines.append(new_line)

        # Pass 2: update parent_bom_line_id references
        for idx, l in enumerate(payload.lines):
            mapped_line = mapped_lines[idx]
            if l.parent_bom_line_id:
                mapped_line.parent_bom_line_id = temp_id_mapping.get(l.parent_bom_line_id)

    await db.commit()
    await db.refresh(bom)

    return BOMHeaderWithLinesResponse(
        id=bom.id,
        part_number=bom.part_number,
        revision_number=bom.revision_number,
        customer_id=bom.customer_id,
        description=bom.description,
        status=bom.status,
        is_active=bom.is_active,
        created_by=bom.created_by,
        created_at=bom.created_at,
        updated_at=bom.updated_at,
        lines=[BOMLineResponse.model_validate(l) for l in mapped_lines]
    )


@router.post("/{id}/release", response_model=BOMHeaderResponse)
async def release_bom_endpoint(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_estimator_or_admin)):
    """Validates the BOM and locks it under RELEASED status, superseding old ones."""
    try:
        operator_email = current_user.get("email")
        released_bom = await BOMRevisionService.release_bom(db, id, operator_email)
        return released_bom
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{id}/new-revision", response_model=BOMHeaderResponse)
async def new_revision_endpoint(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_estimator_or_admin)):
    """Creates a drafting revision (Rev N+1) cloned from a RELEASED BOM."""
    try:
        operator_email = current_user.get("email")
        new_rev = await BOMRevisionService.create_new_revision(db, id, operator_email)
        return new_rev
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{id}/validate", response_model=BOMValidationResponse)
async def validate_bom_endpoint(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    """Triggers the strict programmatic validation suite on a BOM."""
    validation_status = await BOMValidationService.validate_bom(db, id)
    return validation_status


@router.get("/{id}/tree", response_model=List[BOMTreeNode])
async def get_bom_tree_endpoint(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    """Constructs and returns the hierarchical nested traversal of the BOM tree."""
    tree = await BOMTreeService.get_bom_tree(db, id)
    return tree
