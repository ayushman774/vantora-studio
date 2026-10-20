"""Storyboard API lifecycle, validation, ordering and ancestry isolation."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.config import Settings
from app.database.models import Base, Project, Season, Episode, Scene, Shot, Asset
from app.main import create_app

def test_storyboard_frame_lifecycle_and_isolation(tmp_path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        for p in ("p1", "p2"):
            db.add(Project(id=p, name="QA", description="", project_type="anime", created_at=now, updated_at=now))
            db.add(Season(id="s"+p, project_id=p, number=1, title="Season", description="", created_at=now, updated_at=now))
            db.add(Episode(id="e"+p, season_id="s"+p, number=1, title="Episode", synopsis="", created_at=now, updated_at=now))
            db.add(Scene(id="c"+p, episode_id="e"+p, number=1, title="Scene", description="", location="", time_of_day="", status="draft", created_at=now, updated_at=now))
            db.add(Shot(id="h"+p, scene_id="c"+p, number=1, title="Shot", description="", camera="", action="", duration_frames=72, status="draft", created_at=now, updated_at=now))
        db.add(Asset(id="asset-p1",project_id="p1",category="concept",character_id=None,title="Reference",original_name="ref.png",filename="asset-p1.png",media_type="image/png",size_bytes=24,sha256="0"*64,created_at=now))
        db.add(Asset(id="asset-p2",project_id="p2",category="concept",character_id=None,title="Foreign",original_name="foreign.png",filename="asset-p2.png",media_type="image/png",size_bytes=24,sha256="0"*64,created_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root = "/api/v1/projects/p1/seasons/sp1/episodes/ep1/scenes/cp1/shots/hp1/storyboard-frames"
        foreign = "/api/v1/projects/p2/seasons/sp2/episodes/ep2/scenes/cp2/shots/hp2/storyboard-frames"
        response = client.post(root, json={"number": 1, "title": "  Establishing frame  ", "composition": "Wide city", "hold_frames": 48})
        assert response.status_code == 201, response.text
        frame = response.json()
        assert frame["title"] == "Establishing frame"
        assert frame["status"] == "draft"
        fid = frame["id"]
        assert frame["asset_id"] is None
        linked = client.patch(root+"/"+fid,json={"asset_id":"asset-p1"})
        assert linked.status_code == 200, linked.text
        assert linked.json()["asset_id"] == "asset-p1"
        assert client.get(root).json()[0]["asset_id"] == "asset-p1"
        assert client.patch(root+"/"+fid,json={"asset_id":"asset-p2"}).status_code == 422
        assert client.patch(root+"/"+fid,json={"asset_id":"missing"}).status_code == 422
        unlinked = client.patch(root+"/"+fid,json={"asset_id":None})
        assert unlinked.status_code == 200, unlinked.text
        assert unlinked.json()["asset_id"] is None
        assert client.post(root, json={"number": 1, "title": "Duplicate"}).status_code == 409
        assert client.post(root, json={"number": 2, "title": "Invalid", "hold_frames": 0}).status_code == 422
        assert client.post(root, json={"number": 2, "title": " ", "status": "planned"}).status_code == 422
        assert client.patch(root+"/"+fid, json={"status": "unknown"}).status_code == 422
        assert client.patch(root+"/"+fid, json={"status": "planned", "continuity_notes": "Same coat"}).json()["status"] == "planned"
        assert client.patch(root+"/"+fid, json={"title": None}).status_code == 422
        assert len(client.get(root).json()) == 1
        assert client.get(foreign+"/"+fid).status_code == 404
        assert client.get(root.replace("/p1/", "/p2/")).status_code == 404
        assert client.delete(root+"/"+fid).status_code == 204
        assert client.get(root).json() == []
