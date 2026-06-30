from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.user import User, Role
from ..schemas.bootstrap import BootstrapSubmitRequest, BootstrapStatusResponse
from ..core.security import hash_password

router = APIRouter(prefix="/bootstrap", tags=["System Bootstrap"])

@router.get("/status", response_model=BootstrapStatusResponse)
async def get_bootstrap_status(db: AsyncSession = Depends(get_db)):
    """Assess whether a system administrator exists in the registry."""
    result = await db.execute(select(User).join(Role).filter(Role.name == "L2-Admin"))
    admin_exists = result.scalars().first() is not None
    
    return BootstrapStatusResponse(
        bootstrapped=admin_exists,
        config={"company_state": "West Bengal"} if admin_exists else None
    )

@router.post("", status_code=status.HTTP_201_CREATED)
async def run_bootstrap(payload: BootstrapSubmitRequest, db: AsyncSession = Depends(get_db)):
    """Initialize system with primordial administrator."""
    # Check if L2Admin exists
    admin_check = await db.execute(select(User).join(Role).filter(Role.name == "L2-Admin"))
    if admin_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System already bootstrapped. Primary administrator registered."
        )

    # Resolve roles or seed them
    role_check = await db.execute(select(Role).filter(Role.name == "L2-Admin"))
    admin_role = role_check.scalars().first()
    
    if not admin_role:
        # Seed core roles
        admin_role = Role(name="L2-Admin", permissions="bootstrap;user_manage;party_manage;rate_manage;cost_approve")
        estimator_role = Role(name="L1-Estimator", permissions="cost_create")
        pm_role = Role(name="PM", permissions="party_manage;proc_create;po_create")
        sign_role = Role(name="Signatory", permissions="po_sign")
        
        db.add_all([admin_role, estimator_role, pm_role, sign_role])
        await db.commit()
        await db.refresh(admin_role)

    # Put primary administrator
    admin_user = User(
        email=payload.email.strip().lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role_id=admin_role.id,
        is_active=True
    )
    
    db.add(admin_user)
    await db.commit()
    
    return {"success": True, "message": "Bootstrap completed. Core dependencies initialized."}
