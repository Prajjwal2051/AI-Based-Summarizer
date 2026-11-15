import os
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Check for .env in current project root or parent workspace
env_candidates = [
    PROJECT_ROOT / ".env",
    PROJECT_ROOT.parent / ".env",
    PROJECT_ROOT.parent / "langChainModels" / ".env"
]

for env_path in env_candidates:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

class Settings:
    def __init__(self):
        self.ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma2:2b")
        self.ollama_embed_model: str = os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma")
        self.ollama_api_key: str = os.getenv("OLLAMA_API_KEY", "")
        self.backend_host: str = os.getenv("BACKEND_HOST", "0.0.0.0")
        self.backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))

    def update(self, **kwargs):
        for k, v in kwargs.items():
            if hasattr(self, k) and v is not None:
                setattr(self, k, v)

settings = Settings()
