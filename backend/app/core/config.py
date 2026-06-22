import json
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = 'OmniBiz API'
    DATABASE_URL: str = 'sqlite:///./busihub.db'
    SECRET_KEY: str = 'change-me-in-production'
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Accepts either a JSON array string or a plain comma-separated string
    API_ORIGINS: str = '["http://localhost:5173","http://127.0.0.1:5173"]'

    TOKEN_COOKIE_NAME: str = 'omnibiz_access'
    REFRESH_COOKIE_NAME: str = 'omnibiz_refresh'
    USE_SECURE_COOKIES: bool = False

    # SameSite must be 'none' for cross-origin (Vercel → Render)
    # Local dev uses 'lax' so cookies work without HTTPS
    COOKIE_SAMESITE: str = 'lax'

    class Config:
        env_file = '.env'

    @property
    def origins_list(self) -> list[str]:
        """Parse API_ORIGINS whether it's a JSON array or comma-separated string."""
        raw = self.API_ORIGINS.strip()
        if raw.startswith('['):
            return json.loads(raw)
        return [o.strip() for o in raw.split(',') if o.strip()]


settings = Settings()
