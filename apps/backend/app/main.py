from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text
from app.api.v1.router import router
from app.core.config import Settings
from app.core.logging import configure_logging
from app.database.engine import build_engine


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configure_logging(config.data_root, config.log_level)
        engine = build_engine(config.data_root)
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            app.state.engine = engine
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Vantora Studio API", version="0.1.0", lifespan=lifespan)
    app.include_router(router)
    return app

app = create_app()
