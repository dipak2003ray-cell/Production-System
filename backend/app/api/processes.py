from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.process import ProcessMaster
from ..schemas.process import ProcessCreate, ProcessUpdate, ProcessInDB
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/processes", tags=["Process Master"])

@router.get("", response_model=List[ProcessInDB])
async def list_processes(db: AsyncSession = Depends(get_db)):
    """Retrieve all active, non-deleted processes."""
    result = await db.execute(
        select(ProcessMaster)
        .filter(ProcessMaster.is_deleted == False)
        .order_by(ProcessMaster.name)
    )
    return result.scalars().all()

@router.get("/{id}", response_model=ProcessInDB)
async def get_process(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a single process."""
    result = await db.execute(
        select(ProcessMaster)
        .filter(ProcessMaster.id == id, ProcessMaster.is_deleted == False)
    )
    db_process = result.scalars().first()
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
    return db_process

@router.post("", response_model=ProcessInDB, status_code=status.HTTP_201_CREATED)
async def create_process(payload: ProcessCreate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Create a new process."""
    name_stripped = payload.name.strip()
    dupe_check = await db.execute(
        select(ProcessMaster)
        .filter(ProcessMaster.name == name_stripped, ProcessMaster.is_deleted == False)
    )
    if dupe_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A process named: '{name_stripped}' already exists."
        )

    new_process = ProcessMaster(
        name=name_stripped,
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
        driver_type=payload.driver_type.strip() if payload.driver_type else None
    )

    db.add(new_process)
    await db.commit()
    await db.refresh(new_process)
    return new_process

@router.put("/{id}", response_model=ProcessInDB)
async def update_process(id: str, payload: ProcessUpdate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Update an existing process."""
    result = await db.execute(
        select(ProcessMaster)
        .filter(ProcessMaster.id == id, ProcessMaster.is_deleted == False)
    )
    db_process = result.scalars().first()
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")

    update_dict = payload.model_dump(exclude_unset=True)
    if "name" in update_dict:
        name_stripped = update_dict["name"].strip()
        if name_stripped != db_process.name:
            dupe_check = await db.execute(
                select(ProcessMaster)
                .filter(ProcessMaster.name == name_stripped, ProcessMaster.is_deleted == False)
            )
            if dupe_check.scalars().first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A process named: '{name_stripped}' already exists."
                )
            db_process.name = name_stripped

    for key, value in update_dict.items():
        if key != "name":
            setattr(db_process, key, value)

    await db.commit()
    await db.refresh(db_process)
    return db_process

@router.delete("/{id}", response_model=ProcessInDB)
async def delete_process(id: str, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Soft-delete a process master record."""
    result = await db.execute(
        select(ProcessMaster)
        .filter(ProcessMaster.id == id, ProcessMaster.is_deleted == False)
    )
    db_process = result.scalars().first()
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")

    db_process.soft_delete()
    await db.commit()
    await db.refresh(db_process)
    return db_process
