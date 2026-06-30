from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

class BOMLineCreate(BaseModel):
    id: Optional[str] = Field(None, description="Unique temporary or persistent identifier for parent-child tracking")
    parent_bom_line_id: Optional[str] = Field(None, description="Pointer to parent BOM Line for nested hierarchies")
    line_type: str = Field(..., description="BOM Line Category can only be MATERIAL, PROCESS, SUB_ASSEMBLY, NOTE")
    sequence_number: int = Field(..., description="Sequence number for line ordering")
    material_id: Optional[str] = Field(None, description="Associated material if line_type is MATERIAL")
    process_id: Optional[str] = Field(None, description="Associated process if line_type is PROCESS")
    sub_assembly_bom_id: Optional[str] = Field(None, description="Associated sub-assembly BOM Header ID if line_type is SUB_ASSEMBLY")
    description: Optional[str] = Field(None, max_length=255)
    quantity: float = Field(1.0, description="Logical quantity multiplier")
    uom: str = Field(..., max_length=20, description="Unit of measure")
    remarks: Optional[str] = Field(None, max_length=255)

class BOMLineResponse(BaseModel):
    id: str
    bom_header_id: str
    parent_bom_line_id: Optional[str]
    line_type: str
    sequence_number: int
    material_id: Optional[str]
    process_id: Optional[str]
    sub_assembly_bom_id: Optional[str]
    description: Optional[str]
    quantity: float
    uom: str
    remarks: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BOMHeaderCreate(BaseModel):
    part_number: str = Field(..., min_length=1, max_length=100, description="Part Number or product model code")
    customer_id: Optional[str] = Field(None, description="Customer ID associated with the BOM")
    description: Optional[str] = Field(None, max_length=255)
    lines: Optional[List[BOMLineCreate]] = Field(default=[], description="Unfolded line definitions to seed with header creation")

class BOMHeaderResponse(BaseModel):
    id: str
    part_number: str
    revision_number: int
    customer_id: Optional[str]
    description: Optional[str]
    status: str
    is_active: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BOMHeaderWithLinesResponse(BOMHeaderResponse):
    lines: List[BOMLineResponse] = []

    class Config:
        from_attributes = True

class ValidationErrorDetail(BaseModel):
    line_number: Optional[int] = None
    bom_line_id: Optional[str] = None
    field: str
    message: str

class BOMValidationResponse(BaseModel):
    is_valid: bool
    errors: List[ValidationErrorDetail] = []
    warnings: List[str] = []

class BOMTreeNode(BaseModel):
    id: str
    line_type: str
    sequence_number: int
    quantity: float
    uom: str
    description: Optional[str] = None
    material_id: Optional[str] = None
    process_id: Optional[str] = None
    sub_assembly_bom_id: Optional[str] = None
    children: List["BOMTreeNode"] = []
    validation_status: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True
