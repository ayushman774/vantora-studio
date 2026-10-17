from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import text

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/health")
def health(request: Request):
    try:
        with request.app.state.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Database health check failed"})
    return {"status": "ready", "studio": "Vantora Studio", "database": "healthy", "version": "0.1.0"}
