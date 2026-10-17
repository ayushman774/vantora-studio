from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STUDIO_", env_file=".env", extra="ignore")
    env: str = "development"
    data_root: Path = Path.home() / ".vantora-studio"
    log_level: str = "INFO"

settings = Settings()
