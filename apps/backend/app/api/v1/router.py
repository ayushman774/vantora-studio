from fastapi import APIRouter
from app.api.v1.system import router as system_router
from app.api.v1.projects import router as projects_router
from app.api.v1.workspace import router as workspace_router
from app.api.v1.characters import router as characters_router
from app.api.v1.character_references import router as character_references_router

from app.api.v1.assets import router as assets_router

from app.api.v1.scenes import router as scenes_router

router = APIRouter(prefix="/api/v1")
router.include_router(system_router)
router.include_router(projects_router)
router.include_router(workspace_router)
router.include_router(characters_router)
router.include_router(character_references_router)
router.include_router(assets_router)

router.include_router(scenes_router)

from app.api.v1.storyboards import router as storyboards_router
router.include_router(storyboards_router)

from app.api.v1.animatic_export import router as animatic_export_router
router.include_router(animatic_export_router)

from app.api.v1.audio_assets import router as audio_assets_router
router.include_router(audio_assets_router)
