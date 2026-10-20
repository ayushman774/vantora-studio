"""Shot-scoped animatic audio clips; existing video export is unchanged."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.storyboards import parents
from app.database.models import AnimaticAudioClip, AudioAsset

router = APIRouter(
    prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}/scenes/{scene_id}/shots/{shot_id}/audio-clips",
    tags=["Animatic Audio"],
)

class ClipCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audio_asset_id: str
    start_frame: int = Field(default=0, ge=0, le=1000000)
    duration_frames: int = Field(default=264, ge=1, le=1000000)
    volume: float = Field(default=1.0, ge=0, le=2, allow_inf_nan=False)
    muted: bool = False

class ClipUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audio_asset_id: str | None = None
    start_frame: int | None = Field(default=None, ge=0, le=1000000)
    duration_frames: int | None = Field(default=None, ge=1, le=1000000)
    volume: float | None = Field(default=None, ge=0, le=2, allow_inf_nan=False)
    muted: bool | None = None

class ClipOut(ClipCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shot_id: str
    created_at: datetime
    updated_at: datetime

def asset_in_project(db: Session, project_id: str, asset_id: str):
    asset = db.get(AudioAsset, asset_id)
    if asset is None or asset.project_id != project_id:
        raise HTTPException(422, "Audio asset must belong to this project")

def clip_in_shot(db: Session, shot_id: str, clip_id: str):
    clip = db.get(AnimaticAudioClip, clip_id)
    if clip is None or clip.shot_id != shot_id:
        raise HTTPException(404, "Audio clip not found")
    return clip

@router.get("", response_model=list[ClipOut])
def list_clips(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        return db.scalars(select(AnimaticAudioClip).where(AnimaticAudioClip.shot_id == shot_id).order_by(AnimaticAudioClip.start_frame, AnimaticAudioClip.created_at, AnimaticAudioClip.id)).all()

@router.post("", response_model=ClipOut, status_code=201)
def create_clip(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, payload: ClipCreate, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        asset_in_project(db, project_id, payload.audio_asset_id)
        now = datetime.now(timezone.utc)
        clip = AnimaticAudioClip(id=str(uuid4()), shot_id=shot_id, created_at=now, updated_at=now, **payload.model_dump())
        db.add(clip)
        db.commit()
        db.refresh(clip)
        return clip

@router.patch("/{clip_id}", response_model=ClipOut)
def update_clip(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, clip_id: str, payload: ClipUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        clip = clip_in_shot(db, shot_id, clip_id)
        changes = payload.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()):
            raise HTTPException(422, "Audio clip fields cannot be null")
        if "audio_asset_id" in changes:
            asset_in_project(db, project_id, changes["audio_asset_id"])
        for key, value in changes.items():
            setattr(clip, key, value)
        if changes:
            clip.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(clip)
        return clip

@router.delete("/{clip_id}", status_code=204)
def delete_clip(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, clip_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        db.delete(clip_in_shot(db, shot_id, clip_id))
        db.commit()
