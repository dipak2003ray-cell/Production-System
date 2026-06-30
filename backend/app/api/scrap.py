from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.scrap import ScrapTypeMaster
from ..schemas.scrap import ScrapCreate, ScrapUpdate, ScrapInDB
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/scrap", tags=["Scrap Type Master"])

@router.get("", response_model=List[ScrapInDB])
async def list_scrap_types(db: AsyncSession = Depends(get_db)):
    """Retrieve all active, non-deleted scrap type definitions."""
    result = await db.execute(
        select(ScrapTypeMaster)
        .filter(ScrapTypeMaster.is_deleted == False)
        .order_by(ScrapTypeMaster.code)
    )
    return result.scalars().all()

@router.get("/{id}", response_model=ScrapInDB)
async def get_scrap_type(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a single scrap type."""
    result = await db.execute(
        select(ScrapTypeMaster)
        .filter(ScrapTypeMaster.id == id, ScrapTypeMaster.is_deleted == False)
    )
    db_scrap = result.scalars().first()
    if not db_scrap:
        raise HTTPException(status_code=404, detail="Scrap type not found")
    return db_scrap

@router.post("", response_model=ScrapInDB, status_code=status.HTTP_201_CREATED)
async def create_scrap_type(payload: ScrapCreate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Create a new scrap type."""
    uppercase_code = payload.code.strip().upper()
    dupe_check = await db.execute(
        select(ScrapTypeMaster)
        .filter(ScrapTypeMaster.code == uppercase_code, ScrapTypeMaster.is_deleted == False)
    )
    if dupe_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A scrap type with code: '{uppercase_code}' already exists."
        )

    new_scrap = ScrapTypeMaster(
        code=uppercase_code,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active
    )

    db.add(new_scrap)
    await db.commit()
    await db.refresh(new_scrap)
    return new_scrap

@router.put("/{id}", response_model=ScrapInDB)
async def update_scrap_type(id: str, payload: ScrapUpdate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Update an existing scrap type."""
    result = await db.execute(
        select(ScrapTypeMaster)
        .filter(ScrapTypeMaster.id == id, ScrapTypeMaster.is_deleted == False)
    )
    db_scrap = result.scalars().first()
    if not db_scrap:
        raise HTTPException(status_code=404, detail="Scrap type not found")

    update_dict = payload.model_dump(exclude_unset=True)
    if "code" in update_dict:
        uppercase_code = update_dict["code"].strip().upper()
        if uppercase_code != db_scrap.code:
            dupe_check = await db.execute(
                select(ScrapTypeMaster)
                .filter(ScrapTypeMaster.code == uppercase_code, ScrapTypeMaster.is_deleted == False)
            )
            if dupe_check.scalars().first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A scrap type with code: '{uppercase_code}' already exists."
                )
            db_scrap.code = uppercase_code

    for key, value in update_dict.items():
        if key != "code":
            setattr(db_scrap, key, value)

    await db.commit()
    await db.refresh(db_scrap)
    return db_scrap

@router.delete("/{id}", response_model=ScrapInDB)
async def delete_scrap_type(id: str, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Soft-delete a scrap type definition record."""
    result = await db.execute(
        select(ScrapTypeMaster)
        .filter(ScrapTypeMaster.id == id, ScrapTypeMaster.is_deleted == False)
    )
    db_scrap = result.scalars().first()
    if not db_scrap:
        raise HTTPException(status_code=404, detail="Scrap type not found")

    db_scrap.soft_delete()
    await db.commit()
    await db.refresh(db_scrap)
    return db_scrap
