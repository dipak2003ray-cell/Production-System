from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict
import json
from ..database import get_db
from ..schemas.cost_sheet import (
    CostSheetHeaderCreate,
    CostSheetHeaderUpdate,
    CostSheetHeaderResponse,
    CostCalculationSnapshotResponse
)
from ..schemas.material_cost import MaterialCalculateRequest, MaterialCalculateResponse
from ..schemas.process_cost import ProcessCalculateRequest, ProcessCalculateResponse
from ..schemas.scrap_recovery import ScrapCalculateRequest, ScrapCalculateResponse
from ..schemas.cost_rollup import (
    FinalCalculateRequest,
    FinalCalculateResponse,
    CostBreakdownResponse,
    TraceabilityNode
)
from ..services.material_cost_service import MaterialCostService
from ..services.process_cost_service import ProcessCostService
from ..services.scrap_recovery_service import ScrapRecoveryService
from ..services.cost_sheet_service import CostSheetService
from ..services.cost_rollup_engine import CostRollupEngine
from ..core.dependencies import get_token_payload
from ..models.cost_sheet import CostSheetLine

router = APIRouter(prefix="/cost-sheets", tags=["Cost Sheet Foundation"])

async def require_estimator_or_admin(payload: dict = Depends(get_token_payload)) -> dict:
    if payload.get("role") not in ["L2-Admin", "L1-Estimator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Required L2-Admin or L1-Estimator security clearance."
        )
    return payload

async def require_any_role(payload: dict = Depends(get_token_payload)) -> dict:
    if payload.get("role") not in ["L2-Admin", "L1-Estimator", "PM"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to registered company roles."
        )
    return payload

@router.get("", response_model=List[CostSheetHeaderResponse])
async def list_cost_sheets(db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    return await CostSheetService.get_cost_sheets(db)

@router.get("/{id}", response_model=CostSheetHeaderResponse)
async def get_cost_sheet(id: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_any_role)):
    cost_sheet = await CostSheetService.get_cost_sheet(db, id)
    if not cost_sheet:
        raise HTTPException(status_code=404, detail="Cost Sheet not found.")
    return cost_sheet

@router.post("", response_model=CostSheetHeaderResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_sheet(
    payload: CostSheetHeaderCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_estimator_or_admin)
):
    email = current_user.get("email")
    return await CostSheetService.create_cost_sheet(db, payload, creator_email=email)

@router.put("/{id}", response_model=CostSheetHeaderResponse)
async def update_cost_sheet(
    id: str,
    payload: CostSheetHeaderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_estimator_or_admin)
):
    # Retrieve current sheet to enforce status locks and client role restrictions
    existing = await CostSheetService.get_cost_sheet(db, id)
    if not existing:
        raise HTTPException(status_code=404, detail="Cost Sheet not found.")
    
    # Estimators can only edit DRAFT sheets
    role = current_user.get("role")
    if role == "L1-Estimator" and existing.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Estimators can only edit DRAFT Cost Sheets."
        )

    try:
        return await CostSheetService.update_cost_sheet(db, id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{id}/lock", response_model=CostSheetHeaderResponse)
async def lock_cost_sheet(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_estimator_or_admin)
):
    try:
        return await CostSheetService.lock_cost_sheet(db, id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{id}/supersede", response_model=CostSheetHeaderResponse)
async def supersede_cost_sheet(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_estimator_or_admin)
):
    try:
        return await CostSheetService.supersede_cost_sheet(db, id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{id}/snapshot", response_model=CostCalculationSnapshotResponse)
async def get_cost_sheet_snapshot(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    snapshot = await CostSheetService.get_snapshot(db, id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="No calculation snapshot on record for this Cost Sheet.")
    return snapshot

@router.post("/calculate-material", response_model=MaterialCalculateResponse)
async def calculate_material(
    payload: MaterialCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await MaterialCostService.calculate_line_cost(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/material-preview", response_model=MaterialCalculateResponse)
async def material_preview(
    payload: MaterialCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await MaterialCostService.calculate_line_cost(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate-process", response_model=ProcessCalculateResponse)
async def calculate_process(
    payload: ProcessCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await ProcessCostService.calculate_line_cost(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/process-preview", response_model=ProcessCalculateResponse)
async def process_preview(
    payload: ProcessCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await ProcessCostService.calculate_line_cost(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate-scrap", response_model=ScrapCalculateResponse)
async def calculate_scrap(
    payload: ScrapCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await ScrapRecoveryService.calculate_scrap_recovery(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/scrap-preview", response_model=ScrapCalculateResponse)
async def scrap_preview(
    payload: ScrapCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await ScrapRecoveryService.calculate_scrap_recovery(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculate-final", response_model=FinalCalculateResponse)
async def calculate_final(
    payload: FinalCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_estimator_or_admin)
):
    try:
        email = current_user.get("email")
        return await CostRollupEngine.run_final_calculation(db, payload, creator_email=email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/rollup-preview", response_model=FinalCalculateResponse)
async def rollup_preview(
    payload: FinalCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    try:
        return await CostRollupEngine.run_final_calculation(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{id}/breakdown", response_model=CostBreakdownResponse)
async def get_cost_sheet_breakdown(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    header = await CostSheetService.get_cost_sheet(db, id)
    if not header:
        raise HTTPException(status_code=404, detail="Cost Sheet not found.")
    
    m_cost = float(header.total_material_cost or 0)
    p_cost = float(header.total_process_cost or 0)
    scrap_credit = float(header.total_scrap_credit or 0)
    overhead = float(header.total_overhead_cost or 0)
    grand_total = float(header.grand_total_cost or 0)
    
    # Calculate sub assembly from lines
    sub_assem = 0.0
    if header.lines:
        for l in header.lines:
            if l.item_type == "SUB_ASSEMBLY":
                sub_assem += float(l.calculated_subtotal or 0)
                
    denom = grand_total if grand_total > 0 else 1.0
    return CostBreakdownResponse(
        material_cost_pct=round((m_cost / denom) * 100.0, 2),
        process_cost_pct=round((p_cost / denom) * 100.0, 2),
        scrap_credit_pct=round((scrap_credit / denom) * 100.0, 2),
        overhead_pct=round((overhead / denom) * 100.0, 2),
        sub_assembly_pct=round((sub_assem / denom) * 100.0, 2)
    )

@router.get("/{id}/traceability", response_model=List[TraceabilityNode])
async def get_cost_sheet_traceability(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_any_role)
):
    header = await CostSheetService.get_cost_sheet(db, id)
    if not header:
        raise HTTPException(status_code=404, detail="Cost Sheet not found.")
        
    # Group lines by parent_cost_line_id
    lines_by_parent: Dict[Optional[str], List[CostSheetLine]] = {}
    for l in header.lines:
        parent_id = l.parent_cost_line_id
        if parent_id not in lines_by_parent:
            lines_by_parent[parent_id] = []
        lines_by_parent[parent_id].append(l)
        
    def build_node(line: CostSheetLine) -> TraceabilityNode:
        explanation = ""
        code = ""
        if line.audit_trail_json:
            try:
                audit = json.loads(line.audit_trail_json)
                explanation = audit.get("explanation", "")
                code = audit.get("code", "")
            except:
                explanation = line.audit_trail_json
                
        child_lines = lines_by_parent.get(line.id, [])
        children_nodes = [build_node(cl) for cl in child_lines]
        
        return TraceabilityNode(
            id=line.id,
            item_type=line.item_type,
            code=code or line.item_type,
            description=line.bom_line.description if (line.bom_line and line.bom_line.description) else f"{line.item_type} line",
            quantity=float(line.raw_quantity),
            uom=line.bom_line.uom if line.bom_line else "unit",
            rate=float(line.base_rate),
            waste_modifier=float(line.waste_modifier),
            subtotal=float(line.calculated_subtotal),
            explanation=explanation,
            children=children_nodes
        )
        
    roots = lines_by_parent.get(None, [])
    all_line_ids = {l.id for l in header.lines}
    for parent_id, clist in lines_by_parent.items():
        if parent_id is not None and parent_id not in all_line_ids:
            roots.extend(clist)
            
    return [build_node(r) for r in roots]


