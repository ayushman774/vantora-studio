"""v0.16 keyframe CRUD, duration validation and ancestry isolation."""
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.database.models import Base, Project, Season, Episode, Scene, Shot, StoryboardFrame
from app.main import create_app


def test_keyframe_crud_and_scoping(tmp_path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        for p in ("p1", "p2"):
            db.add(Project(id=p, name="Test", description="", project_type="anime", created_at=now, updated_at=now))
            db.add(Season(id="s"+p, project_id=p, number=1, title="Season", description="", created_at=now, updated_at=now))
            db.add(Episode(id="e"+p, season_id="s"+p, number=1, title="Episode", synopsis="", created_at=now, updated_at=now))
            db.add(Scene(id="c"+p, episode_id="e"+p, number=1, title="Scene", description="", location="", time_of_day="", status="draft", created_at=now, updated_at=now))
            db.add(Shot(id="h"+p, scene_id="c"+p, number=1, title="Shot", description="", camera="", action="", duration_frames=48, status="draft", created_at=now, updated_at=now))
            db.add(StoryboardFrame(id="f"+p, shot_id="h"+p, number=1, title="Frame", description="", composition="", camera_notes="", continuity_notes="", hold_frames=48, created_at=now, updated_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root = "/api/v1/projects/p1/seasons/sp1/episodes/ep1/scenes/cp1/shots/hp1/storyboard-frames/fp1/keyframes"
        foreign = "/api/v1/projects/p2/seasons/sp2/episodes/ep2/scenes/cp2/shots/hp2/storyboard-frames/fp2/keyframes"
        created = client.post(root, json={"frame_offset": 0, "position_x": 10, "scale": 1.25})
        assert created.status_code == 201, created.text
        keyframe_id = created.json()["id"]
        assert created.json()["position_x"] == 10
        assert client.get(root+"/"+keyframe_id).json()["position_x"] == 10
        assert client.post(root, json={"frame_offset": 0}).status_code == 409
        assert client.post(root, json={"frame_offset": 48}).status_code == 422
        assert client.post(root, json={"frame_offset": -1}).status_code == 422
        assert client.post(root, json={"frame_offset": 1, "scale": 0}).status_code == 422
        assert client.post(root, json={"frame_offset": 1, "easing": "bounce"}).status_code == 422
        assert client.post(root, json={"frame_offset": 24, "opacity": 0.5}).status_code == 201
        assert [k["frame_offset"] for k in client.get(root).json()] == [0, 24]
        assert client.patch(root+"/"+keyframe_id, json={"frame_offset": 48}).status_code == 422
        assert client.patch(root+"/"+keyframe_id, json={"opacity": None}).status_code == 422
        updated = client.patch(root+"/"+keyframe_id, json={"position_y": 15, "easing": "ease-in-out"})
        assert updated.status_code == 200, updated.text
        assert updated.json()["position_y"] == 15
        assert client.get(foreign+"/"+keyframe_id).status_code == 404
        assert client.get(root.replace("/p1/", "/p2/")).status_code == 404
        assert client.delete(root+"/"+keyframe_id).status_code == 204
        assert len(client.get(root).json()) == 1
