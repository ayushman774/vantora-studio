"""Project-isolated visual layers attached to individual storyboard frames."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.v1.storyboards import parents, frame_or_404
from app.database.models import Asset, VisualLayer

router = APIRouter(
    prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}/scenes/{scene_id}/shots/{shot_id}/storyboard-frames/{frame_id}/layers",
    tags=["Visual Layers"],
)

class LayerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str
    name: str = Field(min_length=1, max_length=160)
    layer_order: int = Field(ge=0)
    position_x: float = Field(default=0, ge=-10000, le=10000, allow_inf_nan=False)
    position_y: float = Field(default=0, ge=-10000, le=10000, allow_inf_nan=False)
    scale: float = Field(default=1, gt=0, le=10, allow_inf_nan=False)
    rotation: float = Field(default=0, ge=-3600, le=3600, allow_inf_nan=False)
    opacity: float = Field(default=1, ge=0, le=1, allow_inf_nan=False)
    visible: bool = True

class LayerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    layer_order: int | None = Field(default=None, ge=0)
    position_x: float | None = Field(default=None, ge=-10000, le=10000, allow_inf_nan=False)
    position_y: float | None = Field(default=None, ge=-10000, le=10000, allow_inf_nan=False)
    scale: float | None = Field(default=None, gt=0, le=10, allow_inf_nan=False)
    rotation: float | None = Field(default=None, ge=-3600, le=3600, allow_inf_nan=False)
    opacity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    visible: bool | None = None

class LayerOut(LayerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    storyboard_frame_id: str
    created_at: datetime
    updated_at: datetime

def scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id):
    parents(db, project_id, season_id, episode_id, scene_id, shot_id)
    frame_or_404(db, shot_id, frame_id)

def find(db, frame_id, layer_id):
    item = db.get(VisualLayer, layer_id)
    if item is None or item.storyboard_frame_id != frame_id:
        raise HTTPException(404, "Visual layer not found")
    return item

def validate(db, project_id, data):
    if "name" in data:
        data["name"] = data["name"].strip()
        if not data["name"]:
            raise HTTPException(422, "Layer name cannot be blank")
    if "asset_id" in data:
        asset = db.get(Asset, data["asset_id"])
        if asset is None or asset.project_id != project_id or not asset.media_type.startswith("image/"):
            raise HTTPException(422, "Layer image asset must belong to this project")
    return data

def commit(db):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Layer order is already occupied or the asset is referenced") from exc

@router.get("", response_model=list[LayerOut])
def list_layers(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id)
        return db.scalars(select(VisualLayer).where(VisualLayer.storyboard_frame_id == frame_id).order_by(VisualLayer.layer_order, VisualLayer.id)).all()

@router.post("", response_model=LayerOut, status_code=201)
def create_layer(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, payload: LayerCreate, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id)
        data = validate(db, project_id, payload.model_dump())
        now = datetime.now(timezone.utc)
        item = VisualLayer(id=str(uuid4()), storyboard_frame_id=frame_id, created_at=now, updated_at=now, **data)
        db.add(item)
        commit(db)
        db.refresh(item)
        return item

@router.get("/{layer_id}", response_model=LayerOut)
def get_layer(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id)
        return find(db, frame_id, layer_id)

@router.patch("/{layer_id}", response_model=LayerOut)
def update_layer(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, payload: LayerUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id)
        item = find(db, frame_id, layer_id)
        data = payload.model_dump(exclude_unset=True)
        if any(value is None for value in data.values()):
            raise HTTPException(422, "Layer fields cannot be null")
        validate(db, project_id, data)
        for key, value in data.items():
            setattr(item, key, value)
        if data:
            item.updated_at = datetime.now(timezone.utc)
        commit(db)
        db.refresh(item)
        return item

@router.delete("/{layer_id}", status_code=204)
def delete_layer(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, layer_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scope(db, project_id, season_id, episode_id, scene_id, shot_id, frame_id)
        db.delete(find(db, frame_id, layer_id))
        commit(db)
