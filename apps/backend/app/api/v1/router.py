from fastapi import APIRouter
from app.api.v1.system import router as system_router
from app.api.v1.projects import router as projects_router
from app.api.v1.workspace import router as workspace_router
from app.api.v1.characters import router as characters_router
from app.api.v1.character_references import router as character_references_router

router = APIRouter(prefix="/api/v1")
router.include_router(system_router)
router.include_router(projects_router)
router.include_router(workspace_router)
router.include_router(characters_router)
router.include_router(character_references_router)
