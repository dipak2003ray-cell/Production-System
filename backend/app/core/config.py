from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "CCS SPACEMAKER Job Costing Platform"
    API_V1_STR: str = "/api/v1"
    
    # DB Parameters
    DATABASE_URL: str = Field("postgresql+asyncpg://postgres:postgres@localhost:5432/spacemaker", env="DATABASE_URL")
    
    # Lockout Mechanics per Sprint 1 security parameters
    FAILED_ATTEMPTS_LIMIT: int = 3
    LOCKOUT_DURATION_MINUTES: int = 15

    # JWT Config
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
