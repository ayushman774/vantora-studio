"""Local project CRUD. No filesystem paths accepted from API clients."""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database.models import Project

router = APIRouter(prefix="/projects", tags=["Projects"])
ProjectType = Literal["anime", "film", "series", "other"]

class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)
    project_type: ProjectType = "anime"

class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    project_type: ProjectType | None = None

class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    project_type: ProjectType
    created_at: datetime
    updated_at: datetime

def clean_name(name: str) -> str:
    value = name.strip()
    if not value:
        raise HTTPException(status_code=422, detail="Project name cannot be blank")
    return value

@router.get("", response_model=list[ProjectOut])
def list_projects(request: Request):
    with Session(request.app.state.engine) as session:
        return session.scalars(select(Project).order_by(Project.updated_at.desc(), Project.id)).all()

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, request: Request):
    now = datetime.now(timezone.utc)
    project = Project(id=str(uuid4()), name=clean_name(payload.name), description=payload.description,
                      project_type=payload.project_type, created_at=now, updated_at=now)
    with Session(request.app.state.engine) as session:
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, request: Request):
    with Session(request.app.state.engine) as session:
        project = session.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, request: Request):
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        if changes["name"] is None:
            raise HTTPException(status_code=422, detail="Project name cannot be null")
        changes["name"] = clean_name(changes["name"])
    if "project_type" in changes and changes["project_type"] is None:
        raise HTTPException(status_code=422, detail="Project type cannot be null")
    if "description" in changes and changes["description"] is None:
        raise HTTPException(status_code=422, detail="Description cannot be null")
    with Session(request.app.state.engine) as session:
        project = session.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        for field, value in changes.items():
            setattr(project, field, value)
        if changes:
            project.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(project)
        return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, request: Request):
    with Session(request.app.state.engine) as session:
        project = session.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        session.delete(project)
        session.commit()
