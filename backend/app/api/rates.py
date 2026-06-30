from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import date
from decimal import Decimal
from ..database import get_db
from ..models.rate import RateCard
from ..models.process import ProcessMaster
from ..models.material import MaterialMaster
from ..models.scrap import ScrapTypeMaster
from ..schemas.rate import RateCardCreate, RateCardUpdate, RateCardInDB
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/rates", tags=["Rate Card Engine"])

async def validate_rate_card_constraints(
    db: AsyncSession,
    payload: RateCardCreate,
    exclude_id: Optional[str] = None
):
    # 1. Target existence checking
    if payload.material_id:
        mat_check = await db.execute(
            select(MaterialMaster).filter(
                MaterialMaster.id == payload.material_id,
                MaterialMaster.is_deleted == False
            )
        )
        if not mat_check.scalars().first():
            raise HTTPException(status_code=400, detail="The assigned material_id does not exist.")

    if payload.scrap_id:
        scrap_check = await db.execute(
            select(ScrapTypeMaster).filter(
                ScrapTypeMaster.id == payload.scrap_id,
                ScrapTypeMaster.is_deleted == False
            )
        )
        if not scrap_check.scalars().first():
            raise HTTPException(status_code=400, detail="The assigned scrap_id does not exist.")

    if payload.process_id:
        proc_check = await db.execute(
            select(ProcessMaster).filter(
                ProcessMaster.id == payload.process_id,
                ProcessMaster.is_deleted == False
            )
        )
        db_proc = proc_check.scalars().first()
        if not db_proc:
            raise HTTPException(status_code=400, detail="The assigned process_id does not exist.")
            
        # 7. Process-driver compatibility validation
        driver_lower = (db_proc.driver_type or "").strip().lower()
        if driver_lower != "thickness" and (payload.thickness_from is not None or payload.thickness_to is not None):
            raise HTTPException(
                status_code=400,
                detail=f"Process '{db_proc.name}' with driver '{db_proc.driver_type}' does not support thickness range constraints."
            )

    # 2. Overlap validation & duplicate active lookup combinations
    query = select(RateCard).filter(
        RateCard.material_id == payload.material_id,
        RateCard.process_id == payload.process_id,
        RateCard.scrap_id == payload.scrap_id,
        RateCard.is_active == True,
        RateCard.is_deleted == False
    )
    if exclude_id:
        query = query.filter(RateCard.id != exclude_id)
        
    res = await db.execute(query)
    active_cards = res.scalars().all()

    p_subtype = (payload.sub_type or "").strip().upper()
    p_tf = payload.thickness_from
    p_tt = payload.thickness_to
    p_eff = payload.effective_date

    for r in active_cards:
        r_subtype = (r.sub_type or "").strip().upper()
        if p_subtype != r_subtype:
            continue

        thickness_overlap = False
        r_tf = r.thickness_from
        r_tt = r.thickness_to

        if p_tf is None and p_tt is None and r_tf is None and r_tt is None:
            thickness_overlap = True
        elif (p_tf is not None or p_tt is not None) and (r_tf is not None or r_tt is not None):
            p_from = p_tf if p_tf is not None else Decimal("0")
            p_to = p_tt if p_tt is not None else Decimal("999999.9999")
            r_from = r_tf if r_tf is not None else Decimal("0")
            r_to = r_tt if r_tt is not None else Decimal("999999.9999")
            if p_from <= r_to and r_from <= p_to:
                thickness_overlap = True

        if thickness_overlap:
            # Reject identical effective date
            if p_eff == r.effective_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Overlapping rate entry: active rate with identical target specification and effective date already exists."
                )
            # Prevent duplicate active lookup combination generally
            if p_tf == r_tf and p_tt == r_tt and r.is_active and payload.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Overlapping rate entry: duplicate active lookup combination exists with overlapping thickness range."
                )

@router.get("", response_model=List[RateCardInDB])
async def list_rates(db: AsyncSession = Depends(get_db)):
    """Retrieve all active, non-deleted rate card configurations."""
    result = await db.execute(
        select(RateCard)
        .filter(RateCard.is_deleted == False)
        .order_by(RateCard.effective_date.desc(), RateCard.created_at.desc())
    )
    return result.scalars().all()

@router.get("/lookup", response_model=Optional[RateCardInDB])
async def lookup_rate(
    material_id: Optional[str] = None,
    process_id: Optional[str] = None,
    scrap_id: Optional[str] = None,
    sub_type: Optional[str] = None,
    thickness: Optional[Decimal] = None,
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    3. Historical preservation & lookup sequence:
    Query the most recent active rate card that was effective on or before a targeted date.
    """
    if not target_date:
        target_date = date.today()

    query = select(RateCard).filter(
        RateCard.material_id == material_id,
        RateCard.process_id == process_id,
        RateCard.scrap_id == scrap_id,
        RateCard.is_active == True,
        RateCard.is_deleted == False,
        RateCard.effective_date <= target_date
    )

    if sub_type:
        query = query.filter(RateCard.sub_type == sub_type)

    if thickness is not None:
        query = query.filter(
            RateCard.thickness_from <= thickness,
            RateCard.thickness_to >= thickness
        )

    # Order by effective_date DESC and created_at DESC matching standard versioning lookups
    query = query.order_by(RateCard.effective_date.desc(), RateCard.created_at.desc()).limit(1)
    
    res = await db.execute(query)
    return res.scalars().first()

@router.post("", response_model=RateCardInDB, status_code=status.HTTP_201_CREATED)
async def create_rate_card(payload: RateCardCreate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Add a new rate card record with robust checks."""
    await validate_rate_card_constraints(db, payload)

    new_rate = RateCard(
        material_id=payload.material_id,
        process_id=payload.process_id,
        scrap_id=payload.scrap_id,
        sub_type=payload.sub_type.strip() if payload.sub_type else None,
        thickness_from=payload.thickness_from,
        thickness_to=payload.thickness_to,
        rate=payload.rate,
        rate_unit=payload.rate_unit.strip(),
        effective_date=payload.effective_date,
        is_active=payload.is_active,
        reason=payload.reason.strip() if payload.reason else "Rate created"
    )

    db.add(new_rate)
    await db.commit()
    await db.refresh(new_rate)
    return new_rate

@router.put("/{id}", response_model=RateCardInDB)
async def update_rate_card(id: str, payload: RateCardUpdate, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Modify an existing rate card with constraint protection."""
    result = await db.execute(
        select(RateCard).filter(RateCard.id == id, RateCard.is_deleted == False)
    )
    db_rate = result.scalars().first()
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate card not found")

    # Build fake create payload to model validate constraints easily
    current_data = {
        "material_id": db_rate.material_id,
        "process_id": db_rate.process_id,
        "scrap_id": db_rate.scrap_id,
        "sub_type": db_rate.sub_type,
        "thickness_from": db_rate.thickness_from,
        "thickness_to": db_rate.thickness_to,
        "rate": db_rate.rate,
        "rate_unit": db_rate.rate_unit,
        "effective_date": db_rate.effective_date,
        "is_active": db_rate.is_active,
        "reason": db_rate.reason
    }

    update_dict = payload.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        current_data[key] = value

    # Build Pydantic Validator object check
    validated_payload = RateCardCreate(**current_data)
    await validate_rate_card_constraints(db, validated_payload, exclude_id=id)

    # Apply updates
    for key, value in update_dict.items():
        setattr(db_rate, key, value)

    await db.commit()
    await db.refresh(db_rate)
    return db_rate

@router.delete("/{id}", response_model=RateCardInDB)
async def delete_rate_card(id: str, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Soft-delete a rate card entry."""
    result = await db.execute(
        select(RateCard).filter(RateCard.id == id, RateCard.is_deleted == False)
    )
    db_rate = result.scalars().first()
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate card not found")

    db_rate.soft_delete()
    await db.commit()
    await db.refresh(db_rate)
    return db_rate
