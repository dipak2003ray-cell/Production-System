from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Set, List
from ..models.bom import BOMHeader, BOMLine
from ..models.material import MaterialMaster
from ..models.process import ProcessMaster
from ..schemas.bom import BOMValidationResponse, ValidationErrorDetail

class BOMValidationService:
    
    @classmethod
    async def detect_circular_reference(cls, db: AsyncSession, root_bom_id: str, target_bom_id: str, visited: Set[str] = None) -> bool:
        """
        Recursively checks if target_bom_id includes root_bom_id as a sub-assembly.
        """
        if visited is None:
            visited = set()
            
        if target_bom_id == root_bom_id:
            return True
        if target_bom_id in visited:
            return False
            
        visited.add(target_bom_id)
        
        # Get all sub-assemblies of target_bom_id
        stmt = select(BOMLine).filter(
            BOMLine.bom_header_id == target_bom_id,
            BOMLine.line_type == "SUB_ASSEMBLY",
            BOMLine.is_deleted == False
        )
        res = await db.execute(stmt)
        sub_lines = res.scalars().all()
        
        for sl in sub_lines:
            if sl.sub_assembly_bom_id:
                if sl.sub_assembly_bom_id == root_bom_id:
                    return True
                # Recursive call
                if await cls.detect_circular_reference(db, root_bom_id, sl.sub_assembly_bom_id, visited.copy()):
                    return True
                    
        return False

    @classmethod
    async def validate_bom(cls, db: AsyncSession, bom_header_id: str) -> BOMValidationResponse:
        """
        Executes a comprehensive structural, lifecycle and integrity audit on a BOM compilation.
        """
        errors: List[ValidationErrorDetail] = []
        warnings: List[str] = []
        
        # 1. Load BOM Header
        stmt_h = select(BOMHeader).filter(BOMHeader.id == bom_header_id, BOMHeader.is_deleted == False)
        res_h = await db.execute(stmt_h)
        header = res_h.scalars().first()
        if not header:
            return BOMValidationResponse(
                is_valid=False,
                errors=[ValidationErrorDetail(field="bom_header_id", message="BOM Header not found or flag deleted.")]
            )
            
        # 2. Load all lines
        stmt_l = select(BOMLine).filter(BOMLine.bom_header_id == bom_header_id, BOMLine.is_deleted == False).order_by(BOMLine.sequence_number)
        res_l = await db.execute(stmt_l)
        lines = res_l.scalars().all()
        line_ids = {l.id for l in lines}
        
        if not lines and header.status == "RELEASED":
            errors.append(ValidationErrorDetail(
                field="status",
                message="BOM in RELEASED status cannot be entirely empty; at least one functional line required."
            ))
            
        # Keep track of duplicates / duplicates sequence
        seqs = []
        
        for l in lines:
            line_lbl = f"Line {l.sequence_number} ({l.line_type})"
            
            # Sequence duplication check
            seqs.append(l.sequence_number)
            
            # Valid type check
            if l.line_type not in ["MATERIAL", "PROCESS", "SUB_ASSEMBLY", "NOTE"]:
                errors.append(ValidationErrorDetail(
                    bom_line_id=l.id,
                    field="line_type",
                    message=f"{line_lbl} possesses invalid line_type '{l.line_type}'."
                ))
            
            # Positive quantity check (NOTE lines are permitted 0 status, others must be strict > 0)
            if l.line_type != "NOTE" and float(l.quantity) <= 0:
                errors.append(ValidationErrorDetail(
                    bom_line_id=l.id,
                    field="quantity",
                    message=f"{line_lbl} must possess a strictly positive quantity; got {l.quantity}."
                ))
                
            # UOM required
            if not l.uom or not l.uom.strip():
                errors.append(ValidationErrorDetail(
                    bom_line_id=l.id,
                    field="uom",
                    message=f"{line_lbl} has missing UOM."
                ))
                
            # Parent/child integrity checking
            if l.parent_bom_line_id:
                if l.parent_bom_line_id == l.id:
                    errors.append(ValidationErrorDetail(
                        bom_line_id=l.id,
                        field="parent_bom_line_id",
                        message=f"{line_lbl} cannot point to itself as its own parent."
                    ))
                elif l.parent_bom_line_id not in line_ids:
                    errors.append(ValidationErrorDetail(
                        bom_line_id=l.id,
                        field="parent_bom_line_id",
                        message=f"{line_lbl} points to parent line '{l.parent_bom_line_id}' which does not reside inside this BOM header."
                    ))
                    
            # MATERIAL references
            if l.line_type == "MATERIAL":
                if not l.material_id:
                    errors.append(ValidationErrorDetail(
                        bom_line_id=l.id,
                        field="material_id",
                        message=f"{line_lbl} specifies a material line without supplying a material master reference."
                    ))
                else:
                    mat_stmt = select(MaterialMaster).filter(MaterialMaster.id == l.material_id, MaterialMaster.is_deleted == False)
                    res_m = await db.execute(mat_stmt)
                    mat = res_m.scalars().first()
                    if not mat:
                        errors.append(ValidationErrorDetail(
                            bom_line_id=l.id,
                            field="material_id",
                            message=f"{line_lbl} references material ID '{l.material_id}' which is deleted or absent from registries."
                        ))
                        
            # PROCESS references
            if l.line_type == "PROCESS":
                if not l.process_id:
                    errors.append(ValidationErrorDetail(
                        bom_line_id=l.id,
                        field="process_id",
                        message=f"{line_lbl} specifies a process line without supplying a process master reference."
                    ))
                else:
                    proc_stmt = select(ProcessMaster).filter(ProcessMaster.id == l.process_id, ProcessMaster.is_deleted == False)
                    res_p = await db.execute(proc_stmt)
                    proc = res_p.scalars().first()
                    if not proc:
                        errors.append(ValidationErrorDetail(
                            bom_line_id=l.id,
                            field="process_id",
                            message=f"{line_lbl} references process ID '{l.process_id}' which is deleted or absent from registries."
                        ))
                    elif not proc.is_active:
                        errors.append(ValidationErrorDetail(
                            bom_line_id=l.id,
                            field="process_id",
                            message=f"{line_lbl} references process '{proc.name}' which is currently inactive."
                        ))
                        
            # SUB_ASSEMBLY references and circular dependencies
            if l.line_type == "SUB_ASSEMBLY":
                if not l.sub_assembly_bom_id:
                    errors.append(ValidationErrorDetail(
                        bom_line_id=l.id,
                        field="sub_assembly_bom_id",
                        message=f"{line_lbl} specifies a sub-assembly line without supplying a sub-assembly BOM header."
                    ))
                else:
                    sub_stmt = select(BOMHeader).filter(BOMHeader.id == l.sub_assembly_bom_id, BOMHeader.is_deleted == False)
                    sub_res = await db.execute(sub_stmt)
                    sub_bom = sub_res.scalars().first()
                    
                    if not sub_bom:
                        errors.append(ValidationErrorDetail(
                            bom_line_id=l.id,
                            field="sub_assembly_bom_id",
                            message=f"{line_lbl} references sub-assembly BOM ID '{l.sub_assembly_bom_id}' which is deleted or absent."
                        ))
                    else:
                        # Circular reference detection
                        if l.sub_assembly_bom_id == bom_header_id:
                            errors.append(ValidationErrorDetail(
                                bom_line_id=l.id,
                                field="sub_assembly_bom_id",
                                message="BOM contains a direct circular reference; it cannot reference itself as a nested assembly."
                            ))
                        else:
                            is_circular = await cls.detect_circular_reference(db, bom_header_id, l.sub_assembly_bom_id)
                            if is_circular:
                                errors.append(ValidationErrorDetail(
                                    bom_line_id=l.id,
                                    field="sub_assembly_bom_id",
                                    message=f"A circular sub-assembly dependency has been detected: referencing BOM [{sub_bom.part_number}] induces an infinite loops."
                                ))
                                
        # Check sequence uniqueness / warnings
        if len(seqs) != len(set(seqs)):
            warnings.append("BOM Lines contain duplicate sequence numbers. Sequencing order might be non-deterministic.")
            
        return BOMValidationResponse(
            is_valid=(len(errors) == 0),
            errors=errors,
            warnings=warnings
        )
