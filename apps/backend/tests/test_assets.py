"""Asset library integration smoke tests using isolated temporary storage."""
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database.models import Base, Project, Character
from app.main import create_app
from app.core.config import Settings
from datetime import datetime, timezone

PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452") + b"\x00" * 16

def test_asset_lifecycle(tmp_path: Path):
    app = create_app(Settings(data_root=tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        db.add(Project(id="project-1", name="Test", description="", project_type="anime", created_at=now, updated_at=now))
        db.add(Character(id="character-1", project_id="project-1", name="Arin", role="lead", biography="", personality="", appearance="", continuity_notes="", created_at=now, updated_at=now))
        db.add(Project(id="project-2", name="Other", description="", project_type="anime", created_at=now, updated_at=now))
        db.add(Character(id="character-2", project_id="project-2", name="Mira", role="lead", biography="", personality="", appearance="", continuity_notes="", created_at=now, updated_at=now))
        db.commit()
    with TestClient(app) as client:
        app.state.engine.dispose()
        app.state.engine = engine
        root = "/api/v1/projects/project-1/assets"
        result = client.post(root + "?category=concept", content=PNG, headers={"Content-Type": "image/png", "X-Filename": "concept.png"})
        assert result.status_code == 201, result.text
        asset = result.json()
        assert asset["category"] == "concept"
        assert len(client.get(root).json()) == 1
        assert client.get(root + "/" + asset["id"] + "/image").content == PNG
        assert client.patch(root + "/" + asset["id"], json={"title": "Hero concept"}).json()["title"] == "Hero concept"
        url = root + "/" + asset["id"]
        assert client.patch(url, json={"character_id": "character-1"}).json()["character_id"] == "character-1"
        assert client.patch(url, json={"character_id": "character-2"}).status_code == 422
        assert client.patch(url, json={"character_id": "missing"}).status_code == 422
        assert client.patch(url, json={"character_id": None}).json()["character_id"] is None
        assert client.delete(root + "/" + asset["id"]).status_code == 204
        assert client.get(root).json() == []
