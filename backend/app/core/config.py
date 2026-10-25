import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional
from dotenv import load_dotenv

# Search for env files in order of precedence: root/.env.local, backend/.env, root/.env
base_dir = Path(__file__).resolve().parent.parent.parent
for env_file in [base_dir.parent / ".env.local", base_dir / ".env", base_dir.parent / ".env"]:
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=False)

if not os.getenv("AWS_BEARER_TOKEN_BEDROCK"):
    local_env = base_dir.parent / ".env.local"
    if local_env.exists():
        load_dotenv(dotenv_path=local_env, override=True)

@dataclass
class Settings:
    PROJECT_NAME: str = "BookLeaf Author Support Portal"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Neon PostgreSQL Database
    DATABASE_URL: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    DATABASE_URL_UNPOOLED: str = field(default_factory=lambda: os.getenv("DATABASE_URL_UNPOOLED", ""))
    NEON_BRANCH: str = field(default_factory=lambda: os.getenv("NEON_BRANCH", "production"))
    
    # AI Provider & AWS Bedrock
    AI_PROVIDER: str = field(default_factory=lambda: os.getenv("AI_PROVIDER", "bedrock"))
    AWS_REGION: str = field(default_factory=lambda: os.getenv("AWS_REGION", "us-east-1"))
    BEDROCK_MODEL_ID: str = field(default_factory=lambda: os.getenv("BEDROCK_MODEL_ID", "minimax.minimax-m2.5"))
    AWS_BEARER_TOKEN_BEDROCK: str = field(default_factory=lambda: os.getenv("AWS_BEARER_TOKEN_BEDROCK", ""))
    
    # CORS & Origins
    ALLOWED_ORIGINS: str = field(default_factory=lambda: os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"))
    
    # Security
    JWT_SECRET: str = field(default_factory=lambda: os.getenv("JWT_SECRET", "bookleaf-secure-secret-key-for-development-32chars"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Circuit Breaker & Timeout Settings (Gate 3: 30s classify, 45s draft)
    AI_CIRCUIT_BREAKER_THRESHOLD: int = 5
    AI_CIRCUIT_BREAKER_RESET_SEC: int = 60
    AI_REQUEST_TIMEOUT_SEC: int = 30
    AI_CLASSIFY_TIMEOUT_SEC: int = 30
    AI_DRAFT_TIMEOUT_SEC: int = 45

    @property
    def bedrock_mantle_endpoint(self) -> str:
        override = os.getenv("BEDROCK_MANTLE_ENDPOINT") or os.getenv("MANTLE_ENDPOINT")
        if override:
            return override.rstrip("/")
        return f"https://bedrock-mantle.{self.AWS_REGION}.api.aws/v1"

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:3000", "http://localhost:5173"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

settings = Settings()
