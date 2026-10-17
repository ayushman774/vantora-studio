from pathlib import Path
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def test_character_crud_and_project_isolation(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_ROOT", str(tmp_path))
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(config, "head")
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        first = client.post("/api/v1/projects", json={"name": "Abyssal Throne"}).json()["id"]
        second = client.post("/api/v1/projects", json={"name": "Other Anime"}).json()["id"]
        base = f"/api/v1/projects/{first}/characters"
        other = f"/api/v1/projects/{second}/characters"
        created = client.post(base, json={"name": "  Daaki  ", "role": "protagonist", "appearance": "Dark cloak"})
        assert created.status_code == 201, created.text
        character = created.json()
        assert character["name"] == "Daaki"
        character_id = character["id"]
        assert client.get(f"{base}/{character_id}").status_code == 200
        assert client.get(f"{other}/{character_id}").status_code == 404
        assert client.patch(f"{other}/{character_id}", json={"name": "Changed"}).status_code == 404
        assert client.delete(f"{other}/{character_id}").status_code == 404
        assert client.get(other).json() == []
        assert client.post(base, json={"name": "   "}).status_code == 422
        assert client.patch(f"{base}/{character_id}", json={"role": None}).status_code == 422
        assert client.patch(f"{base}/{character_id}", json={"name": "   "}).status_code == 422
        updated = client.patch(f"{base}/{character_id}", json={"continuity_notes": "Scar on left cheek"})
        assert updated.status_code == 200
        assert updated.json()["continuity_notes"] == "Scar on left cheek"
        assert client.get("/api/v1/projects/missing/characters").status_code == 404
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        assert len(client.get(base).json()) == 1
        assert client.get(f"{base}/{character_id}").json()["continuity_notes"] == "Scar on left cheek"
        assert client.delete(f"{base}/{character_id}").status_code == 204
        assert client.get(f"{base}/{character_id}").status_code == 404
        assert client.delete(f"{base}/{character_id}").status_code == 404
        assert client.get(base).json() == []
