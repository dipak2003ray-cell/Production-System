from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .security import decode_access_token

security_bearer = HTTPBearer()

async def get_token_payload(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Decodes JWT payload from Bearer token."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired or missing authentication token."
        )
    return payload

async def get_current_admin(payload: dict = Depends(get_token_payload)) -> dict:
    """Forces the user to have L2-Admin role."""
    if payload.get("role") != "L2-Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to L2-Admin role only."
        )
    return payload
