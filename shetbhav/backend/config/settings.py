"""
ShetBhav Configuration
Environment settings for backend application.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

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

# External APIs (verified fallbacks)
AGMARKNET_API_URL = "https://data.gov.in/backend/dmspublic/v1/resources/download"
AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY", "")
