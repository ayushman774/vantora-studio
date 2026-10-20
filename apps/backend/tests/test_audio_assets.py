"""Audio library isolation and file validation tests."""
from datetime import datetime, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.config import Settings
from app.database.models import Base, Project
from app.main import create_app

WAV = b"RIFF" + (40).to_bytes(4, "little") + b"WAVE" + b"fmt " + b"\x00" * 32
MP3 = b"ID3" + b"\x04\x00\x00" + b"\x00" * 32

def test_audio_asset_lifecycle(tmp_path: Path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        for id in ("p1", "p2"):
            db.add(Project(id=id, name=id, description="", project_type="anime", created_at=now, updated_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root = "/api/v1/projects/p1/audio-assets"
        headers = {"Content-Type": "audio/wav", "X-Filename": "theme.wav"}
        response = client.post(root + "?category=music", content=WAV, headers=headers)
        assert response.status_code == 201, response.text
        item = response.json()
        assert item["category"] == "music"
        assert client.get(root).json()[0]["id"] == item["id"]
        assert client.get(root + "/" + item["id"] + "/file").content == WAV
        assert client.get("/api/v1/projects/p2/audio-assets/" + item["id"] + "/file").status_code == 404
        assert client.patch(root + "/" + item["id"], json={"title": "Theme 01"}).json()["title"] == "Theme 01"
        assert client.patch(root + "/" + item["id"], json={"category": "bad"}).status_code == 422
        assert client.post(root, content=b"not audio", headers=headers).status_code == 422
        assert client.post(root, content=WAV, headers={"Content-Type": "image/png"}).status_code == 415
        assert client.post(root + "?category=bad", content=WAV, headers=headers).status_code == 422
        assert client.delete(root + "/" + item["id"]).status_code == 204
        assert client.get(root).json() == []

def test_audio_mp3_header(tmp_path: Path):
    from app.api.v1.audio_assets import valid_audio
    assert valid_audio(MP3, "audio/mpeg")
    assert not valid_audio(b"garbage", "audio/mpeg")
