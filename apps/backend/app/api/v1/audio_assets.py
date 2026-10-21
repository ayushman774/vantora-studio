"""Local audio library: bounded uploads and project-isolated file access."""
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
from app.database.models import AudioAsset, AnimaticAudioClip

router = APIRouter(prefix="/projects/{project_id}/audio-assets", tags=["Audio Assets"])
CATEGORIES = {"music", "sound_effect", "voice"}
MEDIA = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav"}
MAX_BYTES = 50 * 1024 * 1024

class AudioOut(BaseModel):
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

class AudioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = None

def audio_or_404(db: Session, project_id: str, audio_id: str) -> AudioAsset:
    item = db.get(AudioAsset, audio_id)
    if item is None or item.project_id != project_id:
        raise HTTPException(404, "Audio asset not found")
    return item

def audio_root(request: Request, project_id: str) -> Path:
    return request.app.state.data_root / "audio" / project_id

def valid_audio(data: bytes, media_type: str) -> bool:
    if media_type == "audio/mpeg":
        return data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xff and (data[1] & 0xe0) == 0xe0)
    return (len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE")

@router.get("", response_model=list[AudioOut])
def list_audio(project_id: str, request: Request, category: str | None = None):
    if category is not None and category not in CATEGORIES:
        raise HTTPException(422, "Invalid audio category")
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        query = select(AudioAsset).where(AudioAsset.project_id == project_id)
        if category:
            query = query.where(AudioAsset.category == category)
        return db.scalars(query.order_by(AudioAsset.created_at.desc(), AudioAsset.id)).all()

@router.post("", response_model=AudioOut, status_code=201)
async def upload_audio(project_id: str, request: Request, category: str = "music"):
    if category not in CATEGORIES:
        raise HTTPException(422, "Invalid audio category")
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if media_type not in MEDIA:
        raise HTTPException(415, "Only MP3 and WAV audio is supported")
    original_name = unquote(request.headers.get("x-filename", "audio")).strip()
    original_name = Path(original_name.replace("\\", "/")).name[:255] or "audio"
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Audio file exceeds 50 MB")
        data.extend(chunk)
    raw = bytes(data)
    if not raw or not valid_audio(raw, media_type):
        raise HTTPException(422, "Audio contents do not match media type")
    with Session(request.app.state.engine) as db:
        project_or_404(db, project_id)
        audio_id = str(uuid4())
        filename = audio_id + MEDIA[media_type]
        folder = audio_root(request, project_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / filename
        try:
            with target.open("xb") as output:
                output.write(raw)
            item = AudioAsset(
                id=audio_id, project_id=project_id, category=category,
                title=Path(original_name).stem[:160] or "Untitled audio",
                original_name=original_name, filename=filename,
                media_type=media_type, size_bytes=len(raw),
                sha256=hashlib.sha256(raw).hexdigest(),
                created_at=datetime.now(timezone.utc),
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            return item
        except Exception:
            target.unlink(missing_ok=True)
            raise

@router.patch("/{audio_id}", response_model=AudioOut)
def update_audio(project_id: str, audio_id: str, payload: AudioUpdate, request: Request):
    changes = payload.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(422, "Audio fields cannot be null")
    if "category" in changes and changes["category"] not in CATEGORIES:
        raise HTTPException(422, "Invalid audio category")
    if "title" in changes:
        changes["title"] = changes["title"].strip()
        if not changes["title"]:
            raise HTTPException(422, "Title cannot be blank")
    with Session(request.app.state.engine) as db:
        item = audio_or_404(db, project_id, audio_id)
        for key, value in changes.items():
            setattr(item, key, value)
        db.commit()
        db.refresh(item)
        return item

@router.get("/{audio_id}/file")
def get_audio(project_id: str, audio_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        item = audio_or_404(db, project_id, audio_id)
        target = audio_root(request, project_id) / item.filename
        if not target.is_file():
            raise HTTPException(404, "Audio file not found")
        return FileResponse(target, media_type=item.media_type, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@router.delete("/{audio_id}", status_code=204)
def delete_audio(project_id: str, audio_id: str, request: Request):
    with Session(request.app.state.engine) as db:
        item = audio_or_404(db, project_id, audio_id)
        target = audio_root(request, project_id) / item.filename
        linked = db.scalar(select(AnimaticAudioClip.id).where(AnimaticAudioClip.audio_asset_id == audio_id).limit(1))
        if linked is not None:
            raise HTTPException(409, "Remove audio clips from animatic timelines before deleting this file")
        db.delete(item)
        db.commit()
        target.unlink(missing_ok=True)
