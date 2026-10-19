"""Local character reference image storage; binary upload without multipart dependency."""
import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.characters import character_or_404
from app.database.models import CharacterReference

router = APIRouter(prefix="/projects/{project_id}/characters/{character_id}/references", tags=["Character references"])
MAX_BYTES = 10 * 1024 * 1024
MEDIA = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}

class ReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    character_id: str
    original_name: str
    media_type: str
    size_bytes: int
    sha256: str
    created_at: datetime

def root(request: Request) -> Path:
    return request.app.state.data_root / "character-references"

def reference_or_404(db: Session, character_id: str, reference_id: str) -> CharacterReference:
    reference = db.get(CharacterReference, reference_id)
    if reference is None or reference.character_id != character_id:
        raise HTTPException(404, "Reference not found")
    return reference

def valid_image(data: bytes, media_type: str) -> bool:
    if media_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24 and data[12:16] == b"IHDR"
    if media_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9")
    if media_type == "image/webp":
        return len(data) >= 16 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False

@router.get("", response_model=list[ReferenceOut])
def list_references(project_id: str, character_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        character_or_404(db, project_id, character_id)
        return db.scalars(select(CharacterReference).where(CharacterReference.character_id == character_id).order_by(CharacterReference.created_at, CharacterReference.id)).all()

@router.post("", response_model=ReferenceOut, status_code=201)
async def upload_reference(project_id: str, character_id: str, request: Request):
    media_type = request.headers.get("content-type", "").split(";")[0].lower().strip()
    if media_type not in MEDIA:
        raise HTTPException(415, "Only PNG, JPEG, and WebP images are supported")
    name = request.headers.get("x-filename", "reference-image").strip()
    name = Path(name.replace("\\", "/")).name[:255] or "reference-image"
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Image exceeds 10 MB limit")
        data.extend(chunk)
    content = bytes(data)
    if not valid_image(content, media_type):
        raise HTTPException(422, "Image contents do not match its media type")
    with Session(request.app.state.engine) as db:
        character_or_404(db, project_id, character_id)
        reference_id = str(uuid4())
        filename = reference_id + MEDIA[media_type]
        folder = root(request) / character_id
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / filename
        try:
            with target.open("xb") as file:
                file.write(content)
            reference = CharacterReference(
                id=reference_id, character_id=character_id, filename=filename,
                original_name=name, media_type=media_type, size_bytes=len(content),
                sha256=hashlib.sha256(content).hexdigest(), created_at=datetime.now(timezone.utc),
            )
            db.add(reference)
            db.commit()
            db.refresh(reference)
            return reference
        except Exception:
            target.unlink(missing_ok=True)
            raise

@router.get("/{reference_id}/image")
def get_reference_image(project_id: str, character_id: str, reference_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        character_or_404(db, project_id, character_id)
        reference = reference_or_404(db, character_id, reference_id)
        target = root(request) / character_id / reference.filename
        if not target.is_file():
            raise HTTPException(404, "Reference image file not found")
        return FileResponse(target, media_type=reference.media_type, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@router.delete("/{reference_id}", status_code=204)
def delete_reference(project_id: str, character_id: str, reference_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        character_or_404(db, project_id, character_id)
        reference = reference_or_404(db, character_id, reference_id)
        target = root(request) / character_id / reference.filename
        db.delete(reference)
        db.commit()
        target.unlink(missing_ok=True)
