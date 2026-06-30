from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.user import User, Role
from ..schemas.user import UserCreateRequest, UserResponse
from ..core.security import hash_password

router = APIRouter(prefix="/users", tags=["Operator Directory"])

from ..core.dependencies import get_current_admin

@router.get("", response_model=List[UserResponse])
async def list_operators(db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Retrieves all registered operators on the system."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    response = []
    for user in users:
        role_check = await db.execute(select(Role).filter(Role.id == user.role_id))
        role_entity = role_check.scalars().first()
        role_name = role_entity.name if role_entity else "L1-Estimator"
        
        response.append(UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role_name=role_name,
            is_active=user.is_active,
            created_at=user.created_at
        ))
    return response

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_operator(payload: UserCreateRequest, db: AsyncSession = Depends(get_db), admin = Depends(get_current_admin)):
    """Spawn new operator resource."""
    # Check duplicate
    dupe_check = await db.execute(select(User).filter(User.email == payload.email.lower().strip()))
    if dupe_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A registered operator exists with this exact email identity."
        )

    # Check designated role name exists
    role_check = await db.execute(select(Role).filter(Role.name == payload.role_name))
    role_entity = role_check.scalars().first()
    if not role_entity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"System does not maintain a role mapping named '{payload.role_name}'."
        )

    new_user = User(
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role_id=role_entity.id,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role_name=role_entity.name,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )
