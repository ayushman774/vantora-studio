"""Shot-scoped storyboard frame CRUD, with full project ancestry validation."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.scenes import scoped, shot_or_404, STATUSES
from app.database.models import StoryboardFrame

router = APIRouter(
    prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}/scenes/{scene_id}/shots/{shot_id}",
    tags=["Storyboards"],
)

class FrameCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    composition: str = Field(default="", max_length=10000)
    camera_notes: str = Field(default="", max_length=5000)
    continuity_notes: str = Field(default="", max_length=5000)
    hold_frames: int = Field(default=24, ge=1, le=100000)
    status: str = "draft"

class FrameUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10000)
    composition: str | None = Field(default=None, max_length=10000)
    camera_notes: str | None = Field(default=None, max_length=5000)
    continuity_notes: str | None = Field(default=None, max_length=5000)
    hold_frames: int | None = Field(default=None, ge=1, le=100000)
    status: str | None = None

class FrameOut(FrameCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shot_id: str
    created_at: datetime
    updated_at: datetime

def validate(data: dict) -> dict:
    if "title" in data:
        data["title"] = data["title"].strip()
        if not data["title"]:
            raise HTTPException(422, "Title cannot be blank")
    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(422, "Invalid storyboard status")
    return data

def parents(db, project_id, season_id, episode_id, scene_id, shot_id):
    scoped(db, project_id, season_id, episode_id, scene_id)
    shot_or_404(db, scene_id, shot_id)

def frame_or_404(db, shot_id, frame_id):
    frame = db.get(StoryboardFrame, frame_id)
    if frame is None or frame.shot_id != shot_id:
        raise HTTPException(404, "Storyboard frame not found")
    return frame

def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Storyboard frame number already exists in this shot")

@router.get("/storyboard-frames", response_model=list[FrameOut])
def list_frames(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        return db.scalars(select(StoryboardFrame).where(StoryboardFrame.shot_id == shot_id).order_by(StoryboardFrame.number)).all()

@router.post("/storyboard-frames", response_model=FrameOut, status_code=201)
def create_frame(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, payload: FrameCreate, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        now = datetime.now(timezone.utc)
        item = StoryboardFrame(id=str(uuid4()), shot_id=shot_id, created_at=now, updated_at=now, **validate(payload.model_dump()))
        db.add(item)
        commit(db)
        db.refresh(item)
        return item

@router.get("/storyboard-frames/{frame_id}", response_model=FrameOut)
def get_frame(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        return frame_or_404(db, shot_id, frame_id)

@router.patch("/storyboard-frames/{frame_id}", response_model=FrameOut)
def update_frame(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, payload: FrameUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        item = frame_or_404(db, shot_id, frame_id)
        data = payload.model_dump(exclude_unset=True)
        if any(value is None for value in data.values()):
            raise HTTPException(422, "Fields cannot be null")
        for key, value in validate(data).items():
            setattr(item, key, value)
        if data:
            item.updated_at = datetime.now(timezone.utc)
        commit(db)
        db.refresh(item)
        return item

@router.delete("/storyboard-frames/{frame_id}", status_code=204)
def delete_frame(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, frame_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        db.delete(frame_or_404(db, shot_id, frame_id))
        commit(db)
