from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
import json
import uuid
from decimal import Decimal
from datetime import datetime

from ..database import get_db
from ..models.cost_sheet import CostSheetHeader, CostSheetLine
from ..core.dependencies import get_token_payload
from pydantic import BaseModel, Field

router = APIRouter(tags=["Cost Intelligence Workspace"])

# Dependencies
async def require_any_role(payload: dict = Depends(get_token_payload)) -> dict:
    if payload.get("role") not in ["L2-Admin", "L1-Estimator", "PM"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Required L2-Admin, L1-Estimator, or PM role."
        )
    return payload

# Pydantic Schemas
class CostAnalysisResponse(BaseModel):
    cost_sheet_id: str
    bom_header_id: str
    cost_sheet_number: str
    total_material_cost: float
    total_process_cost: float
    total_scrap_credit: float
    total_overhead_cost: float
    total_sub_assembly_cost: float
    grand_total_cost: float
    
    # Percentages
    material_pct: float
    process_pct: float
    scrap_credit_pct: float
    overhead_pct: float
    sub_assembly_pct: float

class ExplorerNode(BaseModel):
    id: str
    name: str
    item_type: str  # MATERIAL, PROCESS, SUB_ASSEMBLY, SCRAP_RECOVERY, OVERHEAD, COST_SHEET
    quantity: float
    uom: str
    rate: float
    subtotal: float
    children: List["ExplorerNode"] = []

class MaterialTraceItem(BaseModel):
    code: str
    description: str
    rate_card_id: str
    effective_date: str
    conversion: str
    waste_factor: float
    final_cost: float

class ProcessTraceItem(BaseModel):
    code: str
    description: str
    driver: str
    rate_card_id: str
    formula: str
    final_cost: float

class ScrapTraceItem(BaseModel):
    scrap_type: str
    rate: float
    recovery_credit: float

class CostTraceabilityResponse(BaseModel):
    cost_sheet_id: str
    materials: List[MaterialTraceItem]
    processes: List[ProcessTraceItem]
    scraps: List[ScrapTraceItem]

class CostSimulationRequest(BaseModel):
    cost_sheet_id: str
    material_rate_change_pct: float = Field(0.0, description="Percent change, e.g. 10.0 for +10%")
    process_rate_change_pct: float = Field(0.0, description="Percent change, e.g. 20.0 for +20%")
    scrap_rate_change_pct: float = Field(0.0, description="Percent change, e.g. -5.0 for -5%")
    overhead_change_pct: float = Field(0.0, description="Percent change, e.g. 10.0 for +10%")
    quantity_change_pct: float = Field(0.0, description="Percent change, e.g. 15.0 for +15%")

class CostSimulationResponse(BaseModel):
    cost_sheet_id: str
    original_material_cost: float
    original_process_cost: float
    original_scrap_credit: float
    original_overhead_cost: float
    original_sub_assembly_cost: float
    original_grand_total: float

    simulated_material_cost: float
    simulated_process_cost: float
    simulated_scrap_credit: float
    simulated_overhead_cost: float
    simulated_sub_assembly_cost: float
    simulated_grand_total: float

    variance_absolute: float
    variance_percentage: float
    impacts: List[Dict[str, str]]

class ScenarioImpact(BaseModel):
    name: str
    factor: str
    original_cost: float
    simulated_cost: float
    variance_absolute: float
    variance_percentage: float
    impact_description: str

class CostImpactResponse(BaseModel):
    cost_sheet_id: str
    scenarios: List[ScenarioImpact]


# Routes Implementation

@router.get("/cost-analysis/{cost_sheet_id}", response_model=CostAnalysisResponse)
async def get_cost_analysis(cost_sheet_id: str, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_any_role)):
    stmt = select(CostSheetHeader).filter(CostSheetHeader.id == cost_sheet_id, CostSheetHeader.is_deleted == False)
    res = await db.execute(stmt)
    cs = res.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cost sheet not found.")
    
    m = float(cs.total_material_cost)
    p = float(cs.total_process_cost)
    s = float(cs.total_scrap_credit)
    o = float(cs.total_overhead_cost)
    
    # Calculate Sub assembly cost if any (from lines)
    stmt_lines = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
    res_lines = await db.execute(stmt_lines)
    lines = res_lines.scalars().all()
    sub_assem = sum(float(l.calculated_subtotal) for l in lines if l.item_type == "SUB_ASSEMBLY")
    
    grand = float(cs.grand_total_cost)
    denom = grand if grand > 0 else 1.0
    
    return CostAnalysisResponse(
        cost_sheet_id=cs.id,
        bom_header_id=cs.bom_header_id,
        cost_sheet_number=cs.cost_sheet_number,
        total_material_cost=m,
        total_process_cost=p,
        total_scrap_credit=s,
        total_overhead_cost=o,
        total_sub_assembly_cost=sub_assem,
        grand_total_cost=grand,
        material_pct=round((m / denom) * 100.0, 2),
        process_pct=round((p / denom) * 100.0, 2),
        scrap_credit_pct=round((s / denom) * 100.0, 2),
        overhead_pct=round((o / denom) * 100.0, 2),
        sub_assembly_pct=round((sub_assem / denom) * 100.0, 2)
    )


@router.get("/cost-explorer/{cost_sheet_id}", response_model=ExplorerNode)
async def get_cost_explorer(cost_sheet_id: str, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_any_role)):
    stmt = select(CostSheetHeader).filter(CostSheetHeader.id == cost_sheet_id, CostSheetHeader.is_deleted == False)
    res = await db.execute(stmt)
    cs = res.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cost sheet not found.")
    
    # Fetch all lines
    stmt_lines = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
    res_lines = await db.execute(stmt_lines)
    lines = res_lines.scalars().all()
    
    # Organize into a tree hierarchy using parent_cost_line_id
    line_map: Dict[Optional[str], List[CostSheetLine]] = {}
    for l in lines:
        parent_id = l.parent_cost_line_id
        if parent_id not in line_map:
            line_map[parent_id] = []
        line_map[parent_id].append(l)
    
    # Load specific line names from audit trail or types
    def get_line_name(l: CostSheetLine) -> str:
        try:
            audit = json.loads(l.audit_trail_json or "{}")
            return audit.get("code", l.item_type)
        except:
            return l.item_type
            
    def build_node(l: CostSheetLine) -> ExplorerNode:
        children_lines = line_map.get(l.id, [])
        children_nodes = [build_node(child) for child in children_lines]
        return ExplorerNode(
            id=l.id,
            name=get_line_name(l),
            item_type=l.item_type,
            quantity=float(l.raw_quantity),
            uom=l.item_type.lower() if not getattr(l, 'uom', '') else getattr(l, 'uom', 'units'),
            rate=float(l.base_rate),
            subtotal=float(l.calculated_subtotal),
            children=children_nodes
        )
    
    # Top-level nodes (parent_cost_line_id is None)
    top_level_lines = line_map.get(None, [])
    top_level_nodes = [build_node(l) for l in top_level_lines]
    
    # Return Root Node
    return ExplorerNode(
        id=cs.id,
        name=cs.cost_sheet_number,
        item_type="COST_SHEET",
        quantity=1.0,
        uom="sheet",
        rate=float(cs.grand_total_cost),
        subtotal=float(cs.grand_total_cost),
        children=top_level_nodes
    )


@router.get("/cost-traceability/{cost_sheet_id}", response_model=CostTraceabilityResponse)
async def get_cost_traceability(cost_sheet_id: str, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_any_role)):
    stmt = select(CostSheetHeader).filter(CostSheetHeader.id == cost_sheet_id, CostSheetHeader.is_deleted == False)
    res = await db.execute(stmt)
    cs = res.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cost sheet not found.")
    
    stmt_lines = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
    res_lines = await db.execute(stmt_lines)
    lines = res_lines.scalars().all()
    
    materials = []
    processes = []
    scraps = []
    
    for l in lines:
        # Parse audit trail safely
        audit = {}
        try:
            if l.audit_trail_json:
                audit = json.loads(l.audit_trail_json)
        except:
            pass
            
        code = audit.get("code", "N/A")
        explanation = audit.get("explanation", l.item_type)
        
        if l.item_type == "MATERIAL":
            materials.append(MaterialTraceItem(
                code=code,
                description=explanation.split(":")[0] if ":" in explanation else l.item_type,
                rate_card_id=audit.get("rate_card_id", "RC-MAT-" + code[:8]),
                effective_date=audit.get("effective_date", cs.created_at.strftime("%Y-%m-%d") if cs.created_at else datetime.utcnow().strftime("%Y-%m-%d")),
                conversion=audit.get("conversion_applied", "None"),
                waste_factor=float(l.waste_modifier),
                final_cost=float(l.calculated_subtotal)
            ))
        elif l.item_type == "PROCESS":
            processes.append(ProcessTraceItem(
                code=code,
                description=explanation.split(":")[0] if ":" in explanation else l.item_type,
                driver=audit.get("driver", "Thickness/Operation Time"),
                rate_card_id=audit.get("rate_card_id", "RC-PROC-" + code[:8]),
                formula=explanation,
                final_cost=float(l.calculated_subtotal)
            ))
        elif l.item_type == "SCRAP_RECOVERY":
            scraps.append(ScrapTraceItem(
                scrap_type=code,
                rate=float(l.base_rate),
                recovery_credit=float(l.calculated_subtotal)
            ))
            
    return CostTraceabilityResponse(
        cost_sheet_id=cs.id,
        materials=materials,
        processes=processes,
        scraps=scraps
    )


@router.post("/cost-simulation", response_model=CostSimulationResponse)
async def post_cost_simulation(req: CostSimulationRequest, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_any_role)):
    stmt = select(CostSheetHeader).filter(CostSheetHeader.id == req.cost_sheet_id, CostSheetHeader.is_deleted == False)
    res = await db.execute(stmt)
    cs = res.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cost sheet not found.")
    
    m = float(cs.total_material_cost)
    p = float(cs.total_process_cost)
    s = float(cs.total_scrap_credit)
    o = float(cs.total_overhead_cost)
    
    # Calculate Sub assembly cost if any (from lines)
    stmt_lines = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == req.cost_sheet_id)
    res_lines = await db.execute(stmt_lines)
    lines = res_lines.scalars().all()
    sub_assem = sum(float(l.calculated_subtotal) for l in lines if l.item_type == "SUB_ASSEMBLY")
    
    orig_grand = float(cs.grand_total_cost)
    
    # Simulated values
    m_change = 1.0 + (req.material_rate_change_pct / 100.0)
    p_change = 1.0 + (req.process_rate_change_pct / 100.0)
    s_change = 1.0 + (req.scrap_rate_change_pct / 100.0)
    qty_change = 1.0 + (req.quantity_change_pct / 100.0)
    
    sim_m = m * m_change * qty_change
    sim_p = p * p_change * qty_change
    sim_s = s * s_change * qty_change
    
    # Scale sub-assembly cost based on weighted inputs
    sub_assem_factor = (m_change + p_change) / 2.0
    sim_sub_assem = sub_assem * sub_assem_factor * qty_change
    
    # Overhead calculation: Overhead is applied on the base cost (m + p - scrap_credit).
    # Scaled by overhead_change_pct
    o_change = 1.0 + (req.overhead_change_pct / 100.0)
    sim_o = o * o_change
    
    sim_grand = sim_m + sim_p - sim_s + sim_o + sim_sub_assem
    
    variance_abs = sim_grand - orig_grand
    variance_pct = (variance_abs / orig_grand * 100.0) if orig_grand > 0 else 0.0
    
    # Format impacts log
    impacts = []
    if req.material_rate_change_pct != 0:
        impacts.append({
            "factor": f"Material Rate {'+' if req.material_rate_change_pct > 0 else ''}{req.material_rate_change_pct}%",
            "impact": f"Final Cost {'+' if variance_pct > 0 else ''}{variance_pct:.1f}%"
        })
    if req.process_rate_change_pct != 0:
        impacts.append({
            "factor": f"Process Rate {'+' if req.process_rate_change_pct > 0 else ''}{req.process_rate_change_pct}%",
            "impact": f"Final Cost {'+' if variance_pct > 0 else ''}{variance_pct:.1f}%"
        })
    if req.scrap_rate_change_pct != 0:
        impacts.append({
            "factor": f"Scrap Rate {'+' if req.scrap_rate_change_pct > 0 else ''}{req.scrap_rate_change_pct}%",
            "impact": f"Final Cost {'+' if variance_pct > 0 else ''}{variance_pct:.1f}%"
        })
    if req.overhead_change_pct != 0:
        impacts.append({
            "factor": f"Overhead Rate {'+' if req.overhead_change_pct > 0 else ''}{req.overhead_change_pct}%",
            "impact": f"Final Cost {'+' if variance_pct > 0 else ''}{variance_pct:.1f}%"
        })
    if req.quantity_change_pct != 0:
        impacts.append({
            "factor": f"Quantity {'+' if req.quantity_change_pct > 0 else ''}{req.quantity_change_pct}%",
            "impact": f"Final Cost {'+' if variance_pct > 0 else ''}{variance_pct:.1f}%"
        })
        
    return CostSimulationResponse(
        cost_sheet_id=cs.id,
        original_material_cost=round(m, 2),
        original_process_cost=round(p, 2),
        original_scrap_credit=round(s, 2),
        original_overhead_cost=round(o, 2),
        original_sub_assembly_cost=round(sub_assem, 2),
        original_grand_total=round(orig_grand, 2),
        simulated_material_cost=round(sim_m, 2),
        simulated_process_cost=round(sim_p, 2),
        simulated_scrap_credit=round(sim_s, 2),
        simulated_overhead_cost=round(sim_o, 2),
        simulated_sub_assembly_cost=round(sim_sub_assem, 2),
        simulated_grand_total=round(sim_grand, 2),
        variance_absolute=round(variance_abs, 2),
        variance_percentage=round(variance_pct, 2),
        impacts=impacts
    )


@router.get("/cost-impact/{cost_sheet_id}", response_model=CostImpactResponse)
async def get_cost_impact(cost_sheet_id: str, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_any_role)):
    stmt = select(CostSheetHeader).filter(CostSheetHeader.id == cost_sheet_id, CostSheetHeader.is_deleted == False)
    res = await db.execute(stmt)
    cs = res.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cost sheet not found.")
        
    m = float(cs.total_material_cost)
    p = float(cs.total_process_cost)
    s = float(cs.total_scrap_credit)
    o = float(cs.total_overhead_cost)
    
    stmt_lines = select(CostSheetLine).filter(CostSheetLine.cost_sheet_header_id == cost_sheet_id)
    res_lines = await db.execute(stmt_lines)
    lines = res_lines.scalars().all()
    sub_assem = sum(float(l.calculated_subtotal) for l in lines if l.item_type == "SUB_ASSEMBLY")
    
    orig_grand = float(cs.grand_total_cost)
    
    # Evaluate standard scenarios:
    # 1. Material Rate +10%
    # 2. Process Rate +15%
    # 3. Scrap Rate +10%
    # 4. Overhead +10%
    # 5. Quantity +10%
    
    scenarios = []
    
    # Scenario 1: Material Rate +10%
    sim_m_1 = m * 1.10
    sim_grand_1 = sim_m_1 + p - s + o + sub_assem
    var_abs_1 = sim_grand_1 - orig_grand
    var_pct_1 = (var_abs_1 / orig_grand * 100.0) if orig_grand > 0 else 0.0
    scenarios.append(ScenarioImpact(
        name="Material Rate Spike",
        factor="Material Rate +10%",
        original_cost=round(orig_grand, 2),
        simulated_cost=round(sim_grand_1, 2),
        variance_absolute=round(var_abs_1, 2),
        variance_percentage=round(var_pct_1, 2),
        impact_description=f"Increase in core raw material prices. Impact: Final Cost +{var_pct_1:.2f}%"
    ))
    
    # Scenario 2: Process Rate +15%
    sim_p_2 = p * 1.15
    sim_grand_2 = m + sim_p_2 - s + o + sub_assem
    var_abs_2 = sim_grand_2 - orig_grand
    var_pct_2 = (var_abs_2 / orig_grand * 100.0) if orig_grand > 0 else 0.0
    scenarios.append(ScenarioImpact(
        name="Processing Cost Shift",
        factor="Process Rate +15%",
        original_cost=round(orig_grand, 2),
        simulated_cost=round(sim_grand_2, 2),
        variance_absolute=round(var_abs_2, 2),
        variance_percentage=round(var_pct_2, 2),
        impact_description=f"Labor or power tariff hikes. Impact: Final Cost +{var_pct_2:.2f}%"
    ))

    # Scenario 3: Scrap Rate +10%
    sim_s_3 = s * 1.10
    sim_grand_3 = m + p - sim_s_3 + o + sub_assem
    var_abs_3 = sim_grand_3 - orig_grand
    var_pct_3 = (var_abs_3 / orig_grand * 100.0) if orig_grand > 0 else 0.0
    scenarios.append(ScenarioImpact(
        name="Scrap Value Spike",
        factor="Scrap Rate +10%",
        original_cost=round(orig_grand, 2),
        simulated_cost=round(sim_grand_3, 2),
        variance_absolute=round(var_abs_3, 2),
        variance_percentage=round(var_pct_3, 2),
        impact_description=f"Better recovery value offset. Impact: Final Cost {'' if var_pct_3 > 0 else '-'}{abs(var_pct_3):.2f}%"
    ))

    # Scenario 4: Overhead Burden +10%
    sim_o_4 = o * 1.10
    sim_grand_4 = m + p - s + sim_o_4 + sub_assem
    var_abs_4 = sim_grand_4 - orig_grand
    var_pct_4 = (var_abs_4 / orig_grand * 100.0) if orig_grand > 0 else 0.0
    scenarios.append(ScenarioImpact(
        name="Overhead Burden Expansion",
        factor="Overhead +10%",
        original_cost=round(orig_grand, 2),
        simulated_cost=round(sim_grand_4, 2),
        variance_absolute=round(var_abs_4, 2),
        variance_percentage=round(var_pct_4, 2),
        impact_description=f"Higher fixed factory allocations. Impact: Final Cost +{var_pct_4:.2f}%"
    ))

    # Scenario 5: Quantity Increase +10%
    sim_m_5 = m * 1.10
    sim_p_5 = p * 1.10
    sim_s_5 = s * 1.10
    sim_sub_assem_5 = sub_assem * 1.10
    # Overheads don't scale directly with production quantity if fixed, but let's assume they scale or keep them constant
    sim_grand_5 = sim_m_5 + sim_p_5 - sim_s_5 + o + sim_sub_assem_5
    var_abs_5 = sim_grand_5 - orig_grand
    var_pct_5 = (var_abs_5 / orig_grand * 100.0) if orig_grand > 0 else 0.0
    scenarios.append(ScenarioImpact(
        name="Batch Scale Expansion",
        factor="Quantity +10%",
        original_cost=round(orig_grand, 2),
        simulated_cost=round(sim_grand_5, 2),
        variance_absolute=round(var_abs_5, 2),
        variance_percentage=round(var_pct_5, 2),
        impact_description=f"Production volume scaling impact. Impact: Final Cost +{var_pct_5:.2f}%"
    ))

    return CostImpactResponse(
        cost_sheet_id=cs.id,
        scenarios=scenarios
    )
