"""Episode-scoped scene and shot production CRUD."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database.models import Scene, Shot
from app.api.v1.workspace import episode_or_404

router = APIRouter(prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}", tags=["Scenes & Shots"])
STATUSES = {"draft", "planned", "in_progress", "review", "approved"}

class SceneCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    location: str = Field(default="", max_length=160)
    time_of_day: str = Field(default="", max_length=80)
    status: str = "draft"

class SceneUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10000)
    location: str | None = Field(default=None, max_length=160)
    time_of_day: str | None = Field(default=None, max_length=80)
    status: str | None = None

class ShotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    camera: str = Field(default="", max_length=5000)
    action: str = Field(default="", max_length=10000)
    duration_frames: int = Field(default=72, ge=1, le=100000)
    status: str = "draft"

class ShotUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10000)
    camera: str | None = Field(default=None, max_length=5000)
    action: str | None = Field(default=None, max_length=10000)
    duration_frames: int | None = Field(default=None, ge=1, le=100000)
    status: str | None = None

class SceneOut(SceneCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    episode_id: str
    created_at: datetime
    updated_at: datetime

class ShotOut(ShotCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    scene_id: str
    created_at: datetime
    updated_at: datetime

def scene_or_404(db, episode_id, scene_id):
    item = db.get(Scene, scene_id)
    if item is None or item.episode_id != episode_id:
        raise HTTPException(404, "Scene not found")
    return item

def shot_or_404(db, scene_id, shot_id):
    item = db.get(Shot, shot_id)
    if item is None or item.scene_id != scene_id:
        raise HTTPException(404, "Shot not found")
    return item

def validate(data):
    if "title" in data:
        data["title"] = data["title"].strip()
        if not data["title"]:
            raise HTTPException(422, "Title cannot be blank")
    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(422, "Invalid production status")
    return data

def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Number already exists in this parent")

def scoped(db, project_id, season_id, episode_id, scene_id=None):
    episode_or_404(db, project_id, season_id, episode_id)
    if scene_id is not None:
        return scene_or_404(db, episode_id, scene_id)

@router.get("/scenes", response_model=list[SceneOut])
def list_scenes(project_id: str, season_id: str, episode_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id)
        return db.scalars(select(Scene).where(Scene.episode_id == episode_id).order_by(Scene.number)).all()

@router.post("/scenes", response_model=SceneOut, status_code=201)
def create_scene(project_id: str, season_id: str, episode_id: str, payload: SceneCreate, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id)
        now = datetime.now(timezone.utc)
        item = Scene(id=str(uuid4()), episode_id=episode_id, created_at=now, updated_at=now, **validate(payload.model_dump()))
        db.add(item); commit(db); db.refresh(item)
        return item

@router.get("/scenes/{scene_id}", response_model=SceneOut)
def get_scene(project_id: str, season_id: str, episode_id: str, scene_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        return scoped(db, project_id, season_id, episode_id, scene_id)

@router.patch("/scenes/{scene_id}", response_model=SceneOut)
def update_scene(project_id: str, season_id: str, episode_id: str, scene_id: str, payload: SceneUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        item = scoped(db, project_id, season_id, episode_id, scene_id)
        data = payload.model_dump(exclude_unset=True)
        if any(v is None for v in data.values()): raise HTTPException(422, "Fields cannot be null")
        for key, value in validate(data).items(): setattr(item, key, value)
        if data: item.updated_at = datetime.now(timezone.utc)
        commit(db); db.refresh(item)
        return item

@router.delete("/scenes/{scene_id}", status_code=204)
def delete_scene(project_id: str, season_id: str, episode_id: str, scene_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        db.delete(scoped(db, project_id, season_id, episode_id, scene_id)); commit(db)

@router.get("/scenes/{scene_id}/shots", response_model=list[ShotOut])
def list_shots(project_id: str, season_id: str, episode_id: str, scene_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id, scene_id)
        return db.scalars(select(Shot).where(Shot.scene_id == scene_id).order_by(Shot.number)).all()

@router.post("/scenes/{scene_id}/shots", response_model=ShotOut, status_code=201)
def create_shot(project_id: str, season_id: str, episode_id: str, scene_id: str, payload: ShotCreate, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id, scene_id)
        now = datetime.now(timezone.utc)
        item = Shot(id=str(uuid4()), scene_id=scene_id, created_at=now, updated_at=now, **validate(payload.model_dump()))
        db.add(item); commit(db); db.refresh(item)
        return item

@router.get("/scenes/{scene_id}/shots/{shot_id}", response_model=ShotOut)
def get_shot(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id, scene_id)
        return shot_or_404(db, scene_id, shot_id)

@router.patch("/scenes/{scene_id}/shots/{shot_id}", response_model=ShotOut)
def update_shot(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, payload: ShotUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id, scene_id)
        item = shot_or_404(db, scene_id, shot_id)
        data = payload.model_dump(exclude_unset=True)
        if any(v is None for v in data.values()): raise HTTPException(422, "Fields cannot be null")
        for key, value in validate(data).items(): setattr(item, key, value)
        if data: item.updated_at = datetime.now(timezone.utc)
        commit(db); db.refresh(item)
        return item

@router.delete("/scenes/{scene_id}/shots/{shot_id}", status_code=204)
def delete_shot(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        scoped(db, project_id, season_id, episode_id, scene_id)
        db.delete(shot_or_404(db, scene_id, shot_id)); commit(db)
