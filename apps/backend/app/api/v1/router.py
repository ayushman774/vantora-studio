from fastapi import APIRouter
from app.api.v1.system import router as system_router
from app.api.v1.projects import router as projects_router

router = APIRouter(prefix="/api/v1")
router.include_router(system_router)
router.include_router(projects_router)
