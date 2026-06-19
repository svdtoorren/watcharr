from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Connection to Watcharr's own schema on the shared MariaDB. Either set
    # DATABASE_URL directly (it wins), or provide the DB_* parts below and
    # Watcharr assembles the URL itself in model_post_init.
    DATABASE_URL: str = ""
    DB_HOST: str = "db"
    DB_PORT: str = "3306"
    DB_NAME: str = "watcharr"
    DB_USER: str = "watcharr"
    DB_PASS: str = "watcharr"

    API_PREFIX: str = "/api"
    # Where the built frontend (Vite dist/) is mounted inside the container.
    STATIC_DIR: str = "/app/static"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def model_post_init(self, _context) -> None:
        # Fall back to the DB_* parts when no explicit DATABASE_URL is given.
        # User/pass are URL-encoded so characters like @ : / in a password
        # don't corrupt the connection string.
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"mysql+aiomysql://{quote_plus(self.DB_USER)}:"
                f"{quote_plus(self.DB_PASS)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )


settings = Settings()
