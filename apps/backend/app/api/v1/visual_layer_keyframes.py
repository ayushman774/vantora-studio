"""Frame-relative visual layer keyframes, scoped through full project ancestry."""
from datetime import datetime, timezone
from math import isfinite
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.storyboards import parents, frame_or_404, EASINGS
from app.database.models import VisualLayerKeyframe, VisualLayer

router = APIRouter(
    prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}/scenes/{scene_id}/shots/{shot_id}/storyboard-frames/{frame_id}/layers/{layer_id}/keyframes",
    tags=["Visual Layer Keyframes"],
)

class KeyframeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    frame_offset: int = Field(ge=0)
    position_x: float = Field(default=0, ge=-10000, le=10000, allow_inf_nan=False)
    position_y: float = Field(default=0, ge=-10000, le=10000, allow_inf_nan=False)
    scale: float = Field(default=1, gt=0, le=10, allow_inf_nan=False)
    rotation: float = Field(default=0, ge=-3600, le=3600, allow_inf_nan=False)
    opacity: float = Field(default=1, ge=0, le=1, allow_inf_nan=False)
    easing: str = "linear"

class KeyframeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    frame_offset: int | None = Field(default=None, ge=0)
    position_x: float | None = Field(default=None, ge=-10000, le=10000, allow_inf_nan=False)
    position_y: float | None = Field(default=None, ge=-10000, le=10000, allow_inf_nan=False)
    scale: float | None = Field(default=None, gt=0, le=10, allow_inf_nan=False)
    rotation: float | None = Field(default=None, ge=-3600, le=3600, allow_inf_nan=False)
    opacity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    easing: str | None = None

class KeyframeOut(KeyframeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    visual_layer_id: str
    created_at: datetime
    updated_at: datetime

def validate(data, hold_frames):
    if "frame_offset" in data and data["frame_offset"] >= hold_frames:
        raise HTTPException(422, "Keyframe must fall within storyboard frame hold duration")
    if "easing" in data and data["easing"] not in EASINGS:
        raise HTTPException(422, "Invalid keyframe easing")
    return data

def scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id):
    parents(db, project_id, season_id, episode_id, scene_id, shot_id)
    frame = frame_or_404(db, shot_id, frame_id, layer_id)
    layer = db.get(VisualLayer, layer_id)
    if layer is None or layer.storyboard_frame_id != frame_id:
        raise HTTPException(404, "Visual layer not found")
    return frame

def keyframe_or_404(db, layer_id, keyframe_id):
    item = db.get(VisualLayerKeyframe, keyframe_id)
    if item is None or item.visual_layer_id != layer_id:
        raise HTTPException(404, "Visual layer keyframe not found")
    return item

def commit(db):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "A keyframe already exists at that frame offset") from exc

@router.get("", response_model=list[KeyframeOut])
def list_keyframes(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id)
        return db.scalars(select(VisualLayerKeyframe).where(VisualLayerKeyframe.visual_layer_id == layer_id).order_by(VisualLayerKeyframe.frame_offset)).all()

@router.post("", response_model=KeyframeOut, status_code=201)
def create_keyframe(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, payload: KeyframeCreate, request: Request):
    with Session(request.app.state.engine) as db:
        frame = scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id)
        data = validate(payload.model_dump(), frame.hold_frames)
        now = datetime.now(timezone.utc)
        item = VisualLayerKeyframe(id=str(uuid4()), visual_layer_id=layer_id, created_at=now, updated_at=now, **data)
        db.add(item)
        commit(db)
        db.refresh(item)
        return item

@router.get("/{keyframe_id}", response_model=KeyframeOut)
def get_keyframe(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, keyframe_id: str, layer_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id)
        return keyframe_or_404(db, layer_id, keyframe_id)

@router.patch("/{keyframe_id}", response_model=KeyframeOut)
def update_keyframe(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, keyframe_id: str, layer_id: str, payload: KeyframeUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        frame = scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id)
        item = keyframe_or_404(db, layer_id, keyframe_id)
        data = payload.model_dump(exclude_unset=True)
        if any(value is None for value in data.values()):
            raise HTTPException(422, "Keyframe fields cannot be null")
        validate(data, frame.hold_frames)
        for key, value in data.items():
            setattr(item, key, value)
        if data:
            item.updated_at = datetime.now(timezone.utc)
        commit(db)
        db.refresh(item)
        return item

@router.delete("/{keyframe_id}", status_code=204)
def delete_keyframe(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, keyframe_id: str, layer_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id, layer_id)
        db.delete(keyframe_or_404(db, layer_id, keyframe_id))
        commit(db)
