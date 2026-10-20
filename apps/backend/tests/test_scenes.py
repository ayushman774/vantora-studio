"""Scene and shot API contract and project isolation tests."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.config import Settings
from app.database.models import Base, Project, Season, Episode
from app.main import create_app

def test_scene_shot_lifecycle_and_isolation(tmp_path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        for project_id in ("p1", "p2"):
            db.add(Project(id=project_id, name="QA", description="", project_type="anime", created_at=now, updated_at=now))
            db.add(Season(id="s"+project_id, project_id=project_id, number=1, title="Season", description="", created_at=now, updated_at=now))
            db.add(Episode(id="e"+project_id, season_id="s"+project_id, number=1, title="Episode", synopsis="", created_at=now, updated_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root = "/api/v1/projects/p1/seasons/sp1/episodes/ep1/scenes"
        foreign = "/api/v1/projects/p2/seasons/sp2/episodes/ep2/scenes"
        result = client.post(root, json={"number": 1, "title": "Opening", "location": "Rooftop"})
        assert result.status_code == 201, result.text
        scene = result.json()
        assert scene["status"] == "draft"
        sid = scene["id"]
        assert client.post(root, json={"number": 1, "title": "Duplicate"}).status_code == 409
        assert client.get(foreign + "/" + sid).status_code == 404
        assert client.patch(root + "/" + sid, json={"status": "invalid"}).status_code == 422
        assert client.patch(root + "/" + sid, json={"status": "planned"}).json()["status"] == "planned"
        shots = root + "/" + sid + "/shots"
        result = client.post(shots, json={"number": 1, "title": "Establishing", "duration_frames": 48, "camera": "Wide"})
        assert result.status_code == 201, result.text
        shot = result.json()
        assert shot["duration_frames"] == 48
        assert client.post(shots, json={"number": 1, "title": "Duplicate"}).status_code == 409
        assert client.post(shots, json={"number": 2, "title": "Invalid", "duration_frames": 0}).status_code == 422
        assert client.get(foreign + "/" + sid + "/shots").status_code == 404
        assert client.patch(shots + "/" + shot["id"], json={"action": "Character turns"}).json()["action"] == "Character turns"
        assert len(client.get(shots).json()) == 1
        assert client.delete(shots + "/" + shot["id"]).status_code == 204
        assert client.get(shots).json() == []
        assert client.delete(root + "/" + sid).status_code == 204
        assert client.get(root).json() == []
