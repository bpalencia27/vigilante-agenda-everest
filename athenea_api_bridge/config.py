import os

class Settings:
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 5050))
    ATHENEA_BASE_URL: str = os.getenv("ATHENEA_BASE_URL", "https://medicosviva1a.atheneasoluciones.com")
    ATHENEA_USER: str = os.getenv("ATHENEA_USER", "CONSULTAMED")
    ATHENEA_PASSWORD: str = os.getenv("ATHENEA_PASSWORD", "Viva1a*md04")
    HEADLESS: bool = os.getenv("HEADLESS", "true").lower() in ("true", "1", "t", "yes")
    PAGE_TIMEOUT: int = int(os.getenv("PAGE_TIMEOUT", 15000))
    SEARCH_TIMEOUT: int = int(os.getenv("SEARCH_TIMEOUT", 10000))

settings = Settings()
