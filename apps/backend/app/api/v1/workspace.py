"""Season and episode CRUD scoped to an existing project."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database.models import Project, Season, Episode

router = APIRouter(prefix="/projects/{project_id}", tags=["Workspace"])

class SeasonCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)

class SeasonUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)

class EpisodeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    synopsis: str = Field(default="", max_length=10000)

class EpisodeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    synopsis: str | None = Field(default=None, max_length=10000)

class SeasonOut(SeasonCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

class EpisodeOut(EpisodeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    season_id: str
    created_at: datetime
    updated_at: datetime

def project_or_404(db: Session, project_id: str):
    if db.get(Project, project_id) is None:
        raise HTTPException(404, "Project not found")

def season_or_404(db: Session, project_id: str, season_id: str) -> Season:
    season = db.get(Season, season_id)
    if season is None or season.project_id != project_id:
        raise HTTPException(404, "Season not found")
    return season

def episode_or_404(db: Session, project_id: str, season_id: str, episode_id: str) -> Episode:
    season_or_404(db, project_id, season_id)
    episode = db.get(Episode, episode_id)
    if episode is None or episode.season_id != season_id:
        raise HTTPException(404, "Episode not found")
    return episode

def cleaned(value: str) -> str:
    value = value.strip()
    if not value:
        raise HTTPException(422, "Title cannot be blank")
    return value

def commit(db: Session):
    try: db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Number already exists in this parent")

@router.get("/seasons", response_model=list[SeasonOut])
def list_seasons(project_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        return db.scalars(select(Season).where(Season.project_id == project_id).order_by(Season.number)).all()

@router.post("/seasons", response_model=SeasonOut, status_code=201)
def create_season(project_id: str, payload: SeasonCreate, request: Request):
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        now = datetime.now(timezone.utc)
        season = Season(id=str(uuid4()), project_id=project_id, number=payload.number, title=cleaned(payload.title), description=payload.description, created_at=now, updated_at=now)
        db.add(season); commit(db); db.refresh(season)
        return season

@router.get("/seasons/{season_id}", response_model=SeasonOut)
def get_season(project_id: str, season_id: str, request: Request):
    with Session(request.app.state.engine) as db: return season_or_404(db, project_id, season_id)

@router.patch("/seasons/{season_id}", response_model=SeasonOut)
def update_season(project_id: str, season_id: str, payload: SeasonUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        season = season_or_404(db, project_id, season_id)
        changes = payload.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()): raise HTTPException(422, "Fields cannot be null")
        if "title" in changes: changes["title"] = cleaned(changes["title"])
        for key, value in changes.items(): setattr(season, key, value)
        if changes: season.updated_at = datetime.now(timezone.utc)
        commit(db); db.refresh(season)
        return season

@router.delete("/seasons/{season_id}", status_code=204)
def delete_season(project_id: str, season_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        db.delete(season_or_404(db, project_id, season_id)); commit(db)

@router.get("/seasons/{season_id}/episodes", response_model=list[EpisodeOut])
def list_episodes(project_id: str, season_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        season_or_404(db, project_id, season_id)
        return db.scalars(select(Episode).where(Episode.season_id == season_id).order_by(Episode.number)).all()

@router.post("/seasons/{season_id}/episodes", response_model=EpisodeOut, status_code=201)
def create_episode(project_id: str, season_id: str, payload: EpisodeCreate, request: Request):
    with Session(request.app.state.engine) as db:
        season_or_404(db, project_id, season_id)
        now = datetime.now(timezone.utc)
        episode = Episode(id=str(uuid4()), season_id=season_id, number=payload.number, title=cleaned(payload.title), synopsis=payload.synopsis, created_at=now, updated_at=now)
        db.add(episode); commit(db); db.refresh(episode)
        return episode

@router.get("/seasons/{season_id}/episodes/{episode_id}", response_model=EpisodeOut)
def get_episode(project_id: str, season_id: str, episode_id: str, request: Request):
    with Session(request.app.state.engine) as db: return episode_or_404(db, project_id, season_id, episode_id)

@router.patch("/seasons/{season_id}/episodes/{episode_id}", response_model=EpisodeOut)
def update_episode(project_id: str, season_id: str, episode_id: str, payload: EpisodeUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        episode = episode_or_404(db, project_id, season_id, episode_id)
        changes = payload.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()): raise HTTPException(422, "Fields cannot be null")
        if "title" in changes: changes["title"] = cleaned(changes["title"])
        for key, value in changes.items(): setattr(episode, key, value)
        if changes: episode.updated_at = datetime.now(timezone.utc)
        commit(db); db.refresh(episode)
        return episode

@router.delete("/seasons/{season_id}/episodes/{episode_id}", status_code=204)
def delete_episode(project_id: str, season_id: str, episode_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        db.delete(episode_or_404(db, project_id, season_id, episode_id)); commit(db)
