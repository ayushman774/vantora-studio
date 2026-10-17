"""Project-scoped character profile API."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database.models import Character, Project

router = APIRouter(prefix="/projects/{project_id}/characters", tags=["Characters"])

class CharacterCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    role: str = Field(default="supporting", min_length=1, max_length=80)
    biography: str = Field(default="", max_length=10000)
    personality: str = Field(default="", max_length=10000)
    appearance: str = Field(default="", max_length=10000)
    continuity_notes: str = Field(default="", max_length=10000)

class CharacterUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=160)
    role: str | None = Field(default=None, min_length=1, max_length=80)
    biography: str | None = Field(default=None, max_length=10000)
    personality: str | None = Field(default=None, max_length=10000)
    appearance: str | None = Field(default=None, max_length=10000)
    continuity_notes: str | None = Field(default=None, max_length=10000)

class CharacterOut(CharacterCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

def project_or_404(db: Session, project_id: str):
    if db.get(Project, project_id) is None:
        raise HTTPException(404, "Project not found")

def character_or_404(db: Session, project_id: str, character_id: str) -> Character:
    character = db.get(Character, character_id)
    if character is None or character.project_id != project_id:
        raise HTTPException(404, "Character not found")
    return character

def clean(value: str, field: str) -> str:
    result = value.strip()
    if not result:
        raise HTTPException(422, f"{field} cannot be blank")
    return result

@router.get("", response_model=list[CharacterOut])
def list_characters(project_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        return db.scalars(select(Character).where(Character.project_id == project_id).order_by(Character.name, Character.id)).all()

@router.post("", response_model=CharacterOut, status_code=201)
def create_character(project_id: str, payload: CharacterCreate, request: Request):
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        now = datetime.now(timezone.utc)
        values = payload.model_dump()
        values["name"] = clean(values["name"], "Name")
        values["role"] = clean(values["role"], "Role")
        character = Character(id=str(uuid4()), project_id=project_id, created_at=now, updated_at=now, **values)
        db.add(character)
        db.commit()
        db.refresh(character)
        return character

@router.get("/{character_id}", response_model=CharacterOut)
def get_character(project_id: str, character_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        return character_or_404(db, project_id, character_id)

@router.patch("/{character_id}", response_model=CharacterOut)
def update_character(project_id: str, character_id: str, payload: CharacterUpdate, request: Request):
    with Session(request.app.state.engine) as db:
        character = character_or_404(db, project_id, character_id)
        changes = payload.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()):
            raise HTTPException(422, "Character fields cannot be null")
        for field in ("name", "role"):
            if field in changes:
                changes[field] = clean(changes[field], field.title())
        for field, value in changes.items():
            setattr(character, field, value)
        if changes:
            character.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(character)
        return character

@router.delete("/{character_id}", status_code=204)
def delete_character(project_id: str, character_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        db.delete(character_or_404(db, project_id, character_id))
        db.commit()
