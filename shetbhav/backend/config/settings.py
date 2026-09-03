"""
ShetBhav Configuration
Environment settings for backend application.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file if present (for local development)
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip()
                if key and key not in os.environ:
                    os.environ[key] = value

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/data/shetbhav.db")

# JWT Auth
SECRET_KEY = os.getenv("SECRET_KEY", "shetbhav-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# CORS
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Demo
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "en")

# File uploads
MAX_UPLOAD_SIZE_MB = 10
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# External APIs — data.gov.in AGMARKNET
DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY", "")
DATA_GOV_RESOURCE_ID = os.getenv("MARKET_DATA_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070")
MARKET_DATA_MODE = os.getenv("MARKET_DATA_MODE", "cached")
MARKET_DATA_CACHE_HOURS = int(os.getenv("MARKET_DATA_CACHE_HOURS", "24"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))
AGMARKNET_API_URL = "https://data.gov.in/backend/dmspublic/v1/resources/download"
AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY", DATA_GOV_API_KEY)
