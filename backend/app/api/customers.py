from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.customer import Customer
from ..schemas.customer import CustomerCreateRequest, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Party Customer Master"])

@router.get("", response_model=List[CustomerResponse])
async def list_parties(db: AsyncSession = Depends(get_db)):
    """Assess registered customer companies."""
    result = await db.execute(select(Customer).filter(Customer.is_deleted == False).order_by(Customer.code))
    return result.scalars().all()

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_party(payload: CustomerCreateRequest, db: AsyncSession = Depends(get_db)):
    """Register party master record. Standard state nullability permitted per AR-04 constraints."""
    # Check duplicate business code
    uppercase_code = payload.code.strip().upper()
    dupe_check = await db.execute(select(Customer).filter(Customer.code == uppercase_code))
    if dupe_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The system already maintains customer records with code: '{uppercase_code}'."
        )

    new_customer = Customer(
        code=uppercase_code,
        name=payload.name.strip(),
        contact_person=payload.contact_person.strip() if payload.contact_person else None,
        email=payload.email,
        phone=payload.phone.strip() if payload.phone else None,
        state=payload.state.strip() if payload.state else None
    )

    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)
    
    return new_customer
