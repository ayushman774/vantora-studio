"""Local project-scoped image assets. No external storage or generation."""
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.characters import project_or_404
from app.api.v1.character_references import valid_image
from app.database.models import Asset

router = APIRouter(prefix="/projects/{project_id}/assets", tags=["Assets"])
MEDIA = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
CATEGORIES = {"concept", "background", "character", "prop", "other"}
MAX_BYTES = 10 * 1024 * 1024

class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    category: str
    title: str
    original_name: str
    media_type: str
    size_bytes: int
    sha256: str
    created_at: datetime

class AssetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = None

def asset_or_404(db: Session, project_id: str, asset_id: str) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.project_id != project_id:
        raise HTTPException(404, "Asset not found")
    return asset

def asset_root(request: Request, project_id: str) -> Path:
    return request.app.state.data_root / "assets" / project_id

@router.get("", response_model=list[AssetOut])
def list_assets(project_id: str, request: Request, category: str | None = None):
    if category is not None and category not in CATEGORIES:
        raise HTTPException(422, "Invalid asset category")
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        query = select(Asset).where(Asset.project_id == project_id)
        if category:
            query = query.where(Asset.category == category)
        return db.scalars(query.order_by(Asset.created_at.desc(), Asset.id)).all()

@router.post("", response_model=AssetOut, status_code=201)
async def upload_asset(project_id: str, request: Request, category: str = "other"):
    if category not in CATEGORIES:
        raise HTTPException(422, "Invalid asset category")
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if media_type not in MEDIA:
        raise HTTPException(415, "Only PNG, JPEG, and WebP images are supported")
    original_name = unquote(request.headers.get("x-filename", "asset")).strip()
    original_name = Path(original_name.replace("\\", "/")).name[:255] or "asset"
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Asset exceeds 10 MB")
        data.extend(chunk)
    raw = bytes(data)
    if not valid_image(raw, media_type):
        raise HTTPException(422, "Image contents do not match media type")
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        asset_id = str(uuid4())
        filename = asset_id + MEDIA[media_type]
        folder = asset_root(request, project_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / filename
        try:
            with target.open("xb") as output:
                output.write(raw)
            asset = Asset(
                id=asset_id, project_id=project_id, category=category,
                title=Path(original_name).stem[:160] or "Untitled asset",
                original_name=original_name, filename=filename,
                media_type=media_type, size_bytes=len(raw),
                sha256=hashlib.sha256(raw).hexdigest(),
                created_at=datetime.now(timezone.utc),
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            return asset
        except Exception:
            target.unlink(missing_ok=True)
            raise

@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(project_id: str, asset_id: str, payload: AssetUpdate, request: Request):
    changes = payload.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(422, "Asset fields cannot be null")
    if "category" in changes and changes["category"] not in CATEGORIES:
        raise HTTPException(422, "Invalid asset category")
    if "title" in changes:
        changes["title"] = changes["title"].strip()
        if not changes["title"]:
            raise HTTPException(422, "Title cannot be blank")
    with Session(request.app.state.engine) as db:
        asset = asset_or_404(db, project_id, asset_id)
        for key, value in changes.items():
            setattr(asset, key, value)
        db.commit()
        db.refresh(asset)
        return asset

@router.get("/{asset_id}/image")
def get_asset_image(project_id: str, asset_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        asset = asset_or_404(db, project_id, asset_id)
        target = asset_root(request, project_id) / asset.filename
        if not target.is_file():
            raise HTTPException(404, "Asset file not found")
        return FileResponse(target, media_type=asset.media_type, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@router.delete("/{asset_id}", status_code=204)
def delete_asset(project_id: str, asset_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        asset = asset_or_404(db, project_id, asset_id)
        target = asset_root(request, project_id) / asset.filename
        db.delete(asset)
        db.commit()
        target.unlink(missing_ok=True)
