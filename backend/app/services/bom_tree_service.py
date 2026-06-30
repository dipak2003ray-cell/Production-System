from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Set, Dict
from ..models.bom import BOMLine
from ..schemas.bom import BOMTreeNode

class BOMTreeService:

    @classmethod
    async def get_bom_tree(cls, db: AsyncSession, bom_header_id: str, visited: Set[str] = None) -> List[BOMTreeNode]:
        """
        Builds a complete, nested, hierarchically traversed BOM tree.
        Integrates nested sub-assemblies to arbitrary depths and detects cycle loops.
        """
        if visited is None:
            visited = set()

        if bom_header_id in visited:
            # We hit a circular dependency, prevent infinite cycles
            return [BOMTreeNode(
                id=f"err-{bom_header_id}",
                line_type="NOTE",
                sequence_number=999,
                quantity=0,
                uom="ERR",
                description="[CIRCULAR DEPENDENCY LOOP DETECTED]",
                validation_status="CIRCULAR_DEPENDENCY"
            )]

        visited.add(bom_header_id)

        # Retrieve all non-deleted lines for this specific header level
        stmt = select(BOMLine).filter(
            BOMLine.bom_header_id == bom_header_id,
            BOMLine.is_deleted == False
        ).order_by(BOMLine.sequence_number)
        res = await db.execute(stmt)
        lines = res.scalars().all()

        # Grouping dictionary and lists of target nodes
        all_nodes: Dict[str, BOMTreeNode] = {}
        for l in lines:
            all_nodes[l.id] = BOMTreeNode(
                id=l.id,
                line_type=l.line_type,
                sequence_number=l.sequence_number,
                quantity=float(l.quantity),
                uom=l.uom,
                description=l.description,
                material_id=l.material_id,
                process_id=l.process_id,
                sub_assembly_bom_id=l.sub_assembly_bom_id,
                remarks=l.remarks,
                children=[]
            )

        # Build trees and recursively fetch sub-assemblies
        root_nodes: List[BOMTreeNode] = []

        for l in lines:
            node = all_nodes[l.id]

            # If the node represents a nested sub-assembly, recursively expand its own tree!
            if l.line_type == "SUB_ASSEMBLY" and l.sub_assembly_bom_id:
                if l.sub_assembly_bom_id in visited:
                    error_node = BOMTreeNode(
                        id=f"err-{l.sub_assembly_bom_id}",
                        line_type="NOTE",
                        sequence_number=1,
                        quantity=0,
                        uom="ERR",
                        description=f"[CIRCULAR DEPENDENCY LOOP: BOM refers back to {l.sub_assembly_bom_id[:8]}]",
                        validation_status="CIRCULAR_DEPENDENCY"
                    )
                    node.children = [error_node]
                    node.validation_status = "INVALID"
                else:
                    sub_tree = await cls.get_bom_tree(db, l.sub_assembly_bom_id, visited.copy())
                    node.children.extend(sub_tree)
                    node.validation_status = "VALID"

            # Route to respective parent node within the current scope, or designate as a root node of this level
            if l.parent_bom_line_id and l.parent_bom_line_id in all_nodes:
                parent_node = all_nodes[l.parent_bom_line_id]
                parent_node.children.append(node)
            else:
                root_nodes.append(node)

        return root_nodes
