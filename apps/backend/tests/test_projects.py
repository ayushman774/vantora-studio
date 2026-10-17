from pathlib import Path
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def test_project_crud_and_persistence(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_ROOT", str(tmp_path))
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(config, "head")
    app = create_app(Settings(data_root=tmp_path))
    with TestClient(app) as client:
        assert client.get("/api/v1/projects").json() == []
        response = client.post("/api/v1/projects", json={"name": "  Abyssal Throne  ", "project_type": "anime"})
        assert response.status_code == 201, response.text
        project = response.json()
        assert project["name"] == "Abyssal Throne"
        project_id = project["id"]
        assert client.get(f"/api/v1/projects/{project_id}").status_code == 200
        assert len(client.get("/api/v1/projects").json()) == 1
        updated = client.patch(f"/api/v1/projects/{project_id}", json={"description": "First season"})
        assert updated.status_code == 200
        assert updated.json()["description"] == "First season"
        assert client.post("/api/v1/projects", json={"name": "   "}).status_code == 422
        assert client.patch(f"/api/v1/projects/{project_id}", json={"name": None}).status_code == 422
        assert client.get("/api/v1/projects/not-found").status_code == 404
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        assert client.get(f"/api/v1/projects/{project_id}").json()["description"] == "First season"
        assert client.delete(f"/api/v1/projects/{project_id}").status_code == 204
        assert client.get("/api/v1/projects").json() == []
        assert client.delete(f"/api/v1/projects/{project_id}").status_code == 404
