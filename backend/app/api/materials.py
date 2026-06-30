from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.material import MaterialMaster
from ..schemas.material import MaterialCreate, MaterialUpdate, MaterialInDB
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/materials", tags=["Material Master"])

@router.get("", response_model=List[MaterialInDB])
async def list_materials(db: AsyncSession = Depends(get_db)):
    """Retrieve all active, non-deleted materials."""
    result = await db.execute(
        select(MaterialMaster)
        .filter(MaterialMaster.is_deleted == False)
        .order_by(MaterialMaster.code)
    )
    return result.scalars().all()

@router.get("/{id}", response_model=MaterialInDB)
async def get_material(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a single material."""
    result = await db.execute(
        select(MaterialMaster)
        .filter(MaterialMaster.id == id, MaterialMaster.is_deleted == False)
    )
    db_material = result.scalars().first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return db_material

@router.post("", response_model=MaterialInDB, status_code=status.HTTP_201_CREATED)
async def create_material(payload: MaterialCreate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Create a new material."""
    # Check duplicate code
    uppercase_code = payload.code.strip().upper()
    dupe_check = await db.execute(
        select(MaterialMaster)
        .filter(MaterialMaster.code == uppercase_code, MaterialMaster.is_deleted == False)
    )
    if dupe_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A material with code: '{uppercase_code}' already exists."
        )

    new_material = MaterialMaster(
        code=uppercase_code,
        description=payload.description.strip(),
        grade_spec=payload.grade_spec.strip() if payload.grade_spec else None,
        profile_size=payload.profile_size.strip() if payload.profile_size else None,
        std_unit=payload.std_unit.strip(),
        last_rate=payload.last_rate
    )

    db.add(new_material)
    await db.commit()
    await db.refresh(new_material)
    return new_material

@router.put("/{id}", response_model=MaterialInDB)
async def update_material(id: str, payload: MaterialUpdate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Modify an existing material."""
    result = await db.execute(
        select(MaterialMaster)
        .filter(MaterialMaster.id == id, MaterialMaster.is_deleted == False)
    )
    db_material = result.scalars().first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")

    update_dict = payload.model_dump(exclude_unset=True)
    
    if "code" in update_dict:
        uppercase_code = update_dict["code"].strip().upper()
        if uppercase_code != db_material.code:
            dupe_check = await db.execute(
                select(MaterialMaster)
                .filter(MaterialMaster.code == uppercase_code, MaterialMaster.is_deleted == False)
            )
            if dupe_check.scalars().first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A material with code: '{uppercase_code}' already exists."
                )
            db_material.code = uppercase_code

    for key, value in update_dict.items():
        if key != "code":
            setattr(db_material, key, value)

    await db.commit()
    await db.refresh(db_material)
    return db_material

@router.delete("/{id}", response_model=MaterialInDB)
async def delete_material(id: str, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Soft-delete a material master record."""
    result = await db.execute(
        select(MaterialMaster)
        .filter(MaterialMaster.id == id, MaterialMaster.is_deleted == False)
    )
    db_material = result.scalars().first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")

    db_material.soft_delete()
    await db.commit()
    await db.refresh(db_material)
    return db_material
