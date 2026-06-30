import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.user import User, Role
from ..models.session import UserSession
from ..schemas.user import UserLoginRequest, TokenResponse, TokenRefreshRequest, UserResponse
from ..core.security import verify_password, create_access_token
from ..core.config import settings

router = APIRouter(prefix="/auth", tags=["Token Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate credentials, assess active lockouts, and return session tokens."""
    # Lookup email
    user_check = await db.execute(
        select(User).join(Role).filter(User.email == payload.email.lower().strip())
    )
    user = user_check.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The credentials provided do not match our records."
        )

    # Check active lockout
    now = datetime.datetime.utcnow()
    if user.locked_until and now < user.locked_until:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account temporarily locked due to repeated authentication failures. Try again after {user.locked_until.isoformat()}."
        )

    # Verify password
    if not verify_password(payload.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.FAILED_ATTEMPTS_LIMIT:
            user.locked_until = now + datetime.timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Secure account lock activated. Too many consecutive password entries failure. Account locked for 15 minutes."
            )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The credentials provided do not match our records."
        )

    # Reset metrics on correct verification
    user.failed_login_attempts = 0
    user.locked_until = None

    # Retrieve role name
    role_check = await db.execute(select(Role).filter(Role.id == user.role_id))
    role_entity = role_check.scalars().first()
    role_name = role_entity.name if role_entity else "L1-Estimator"

    # Assemble access claims
    access_claims = {
        "id": user.id,
        "email": user.email,
        "role": role_name,
        "name": user.full_name
    }
    
    access_token = create_access_token(
        data=access_claims,
        expires_delta=datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    # Establish persistent secure session token
    refresh_token = str(uuid.uuid4()).replace("-", "")
    new_session = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=now + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False
    )
    db.add(new_session)
    await db.commit()

    user_data = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_name=role_name,
        is_active=user.is_active,
        created_at=user.created_at
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_data
    )

@router.post("/refresh")
async def rotate_tokens(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchanges old active refresh token for a rotated, fresh key set."""
    now = datetime.datetime.utcnow()
    
    # Find active session
    sess_check = await db.execute(
        select(UserSession).filter(
            UserSession.refresh_token == payload.refresh_token,
            UserSession.is_revoked == False,
            UserSession.expires_at > now
        )
    )
    session = sess_check.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User session expired or actively revoked.")

    user_check = await db.execute(
        select(User).join(Role).filter(User.id == session.user_id, User.is_active == True)
    )
    user = user_check.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Profile associated with session de-authorized.")

    # Revoke old token and rotate
    session.is_revoked = True

    # Retrieve role name
    role_check = await db.execute(select(Role).filter(Role.id == user.role_id))
    role_entity = role_check.scalars().first()
    role_name = role_entity.name if role_entity else "L1-Estimator"

    access_claims = {
        "id": user.id,
        "email": user.email,
        "role": role_name,
        "name": user.full_name
    }
    new_access = create_access_token(data=access_claims)
    new_refresh = str(uuid.uuid4()).replace("-", "")

    new_session = UserSession(
        user_id=user.id,
        refresh_token=new_refresh,
        expires_at=now + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False
    )
    db.add(new_session)
    await db.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer"
    }

@router.post("/logout")
async def logout_user(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Revokes active token profile on session cleanup."""
    sess_check = await db.execute(
        select(UserSession).filter(UserSession.refresh_token == payload.refresh_token)
    )
    session = sess_check.scalars().first()
    if session:
        session.is_revoked = True
        await db.commit()
    return {"success": True, "message": "Logged out and token session dissolved."}
