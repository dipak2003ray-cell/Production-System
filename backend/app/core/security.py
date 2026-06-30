import os
import sys
import datetime
from typing import Optional, dict
from jose import jwt, JWTError
from passlib.context import CryptContext

# Configuration of Password Hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security defaults
ALGORITHM = "RS256"

# Determine environment
ENV = os.getenv("ENV") or os.getenv("APP_ENV") or "development"
is_production = ENV.lower() == "production"

# Check environment variables directly
raw_private_key = os.getenv("JWT_PRIVATE_KEY")
raw_public_key = os.getenv("JWT_PUBLIC_KEY")

# Check if keys are missing or contain placeholders
is_missing_or_placeholder = (
    not raw_private_key or 
    not raw_public_key or 
    "[truncated" in raw_private_key or 
    "insert-private-key-here" in raw_private_key or
    "insert-public-key-here" in raw_public_key or
    "[truncated" in raw_public_key
)

if is_production:
    if is_missing_or_placeholder:
        print("=" * 80, file=sys.stderr)
        print("CRITICAL: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are REQUIRED in production.", file=sys.stderr)
        print("Application cannot start in production environment without valid RSA key structures.", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        raise ValueError("Production configuration violation: Valid asymmetric RSA-2048 keys (JWT_PRIVATE_KEY and JWT_PUBLIC_KEY) are required in production.")
    else:
        JWT_PRIVATE_KEY = raw_private_key
        JWT_PUBLIC_KEY = raw_public_key
else:
    # Development environment key management
    if is_missing_or_placeholder:
        print("=" * 80)
        print(" WARNING: JWT keys are missing or invalid in development.")
        print(" Generating temporary RSA-2048 keypair in memory for current session...")
        print(" " + "*" * 60)
        print(" Development keys in use. Not suitable for production. ")
        print(" " + "*" * 60)
        print("=" * 80)
        
        try:
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import serialization
            
            # Keep key files generated automatically inside current memory scope
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048
            )
            
            JWT_PRIVATE_KEY = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ).decode("utf-8")
            
            public_key = private_key.public_key()
            JWT_PUBLIC_KEY = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode("utf-8")
            
        except Exception as e:
            print(f"Failed to use cryptography library for RSA generation: {e}", file=sys.stderr)
            print("Falling back to local HS256 simulation key for development testing.", file=sys.stderr)
            JWT_PRIVATE_KEY = "LOCAL_DEVELOPMENT_SECRET_KEY"
            JWT_PUBLIC_KEY = "LOCAL_DEVELOPMENT_SECRET_KEY"
    else:
        JWT_PRIVATE_KEY = raw_private_key
        JWT_PUBLIC_KEY = raw_public_key

def hash_password(password: str) -> str:
    """Hash password string using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Encodes custom authorization claims with RS256 as requested in specifications."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    
    to_encode.update({"exp": expire})
    
    try:
        # Sign with private key
        encoded_jwt = jwt.encode(to_encode, JWT_PRIVATE_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except JWTError as e:
        # Prevent silent insecure fallback in production if keys are missing or misconfigured
        if os.getenv("APP_ENV") == "production" or os.getenv("ENV") == "production":
            raise ValueError("Insecure signature fallback to HS256 is blocked in production. Valid RS256 private key is required.") from e
        # Fallback to HS256 for local environment compatibility if RSA loading lacks cert parameters
        return jwt.encode(to_encode, "LOCAL_SECRET_FALLBACK", algorithm="HS256")

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes claims using either RS25Public or HS256 depending on fallback signature."""
    try:
        # Decode claims
        return jwt.decode(token, JWT_PUBLIC_KEY, algorithms=[ALGORITHM])
    except JWTError:
        # Forbid fallback verification secret keys in production environment
        if os.getenv("APP_ENV") == "production" or os.getenv("ENV") == "production":
            return None
        try:
            return jwt.decode(token, "LOCAL_SECRET_FALLBACK", algorithms=["HS256"])
        except JWTError:
            return None
