"""Audio clip persistence, project isolation, and linked asset protection."""
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.database.models import Base, Project, Season, Episode, Scene, Shot, AudioAsset
from app.main import create_app

def test_audio_clip_lifecycle(tmp_path: Path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        db.add(Project(id="p1", name="Test", description="", project_type="anime", created_at=now, updated_at=now))
        db.add(Project(id="p2", name="Other", description="", project_type="anime", created_at=now, updated_at=now))
        db.add(Season(id="s1", project_id="p1", number=1, title="Season", description="", created_at=now, updated_at=now))
        db.add(Episode(id="e1", season_id="s1", number=1, title="Episode", synopsis="", created_at=now, updated_at=now))
        db.add(Scene(id="c1", episode_id="e1", number=1, title="Scene", description="", location="", time_of_day="", status="draft", created_at=now, updated_at=now))
        db.add(Shot(id="h1", scene_id="c1", number=1, title="Shot", description="", camera="", action="", duration_frames=264, status="draft", created_at=now, updated_at=now))
        for id, project in (("a1","p1"),("a2","p2")):
            db.add(AudioAsset(id=id, project_id=project, category="music", title="Music", original_name="music.wav", filename=id+".wav", media_type="audio/wav", size_bytes=32, sha256="0"*64, created_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root="/api/v1/projects/p1/seasons/s1/episodes/e1/scenes/c1/shots/h1/audio-clips"
        assert client.post(root, json={"audio_asset_id":"a2"}).status_code == 422
        created=client.post(root, json={"audio_asset_id":"a1","start_frame":0,"duration_frames":264,"volume":0.8})
        assert created.status_code == 201, created.text
        clip=created.json()
        assert clip["duration_frames"] == 264
        assert len(client.get(root).json()) == 1
        assert client.post(root,json={"audio_asset_id":"a1","start_frame":-1}).status_code == 422
        assert client.patch(root+"/"+clip["id"],json={"volume":-1}).status_code == 422
        assert client.patch(root+"/"+clip["id"],json={"audio_asset_id":"a2"}).status_code == 422
        assert client.patch(root+"/"+clip["id"],json={"start_frame":48,"muted":True}).json()["start_frame"] == 48
        assert client.delete("/api/v1/projects/p1/audio-assets/a1").status_code == 409
        assert client.delete(root+"/"+clip["id"]).status_code == 204
        assert client.get(root).json() == []
        assert client.delete("/api/v1/projects/p1/audio-assets/a1").status_code == 204
