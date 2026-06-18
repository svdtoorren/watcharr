from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Connection string for Watcharr's own schema on the shared MariaDB.
    DATABASE_URL: str = "mysql+aiomysql://watcharr:watcharr@db:3306/watcharr"
    API_PREFIX: str = "/api"
    # Where the built frontend (Vite dist/) is mounted inside the container.
    STATIC_DIR: str = "/app/static"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
