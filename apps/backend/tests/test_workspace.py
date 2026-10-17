from pathlib import Path
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def test_workspace_hierarchy(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_ROOT", str(tmp_path))
    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(cfg, "head")
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        project = client.post("/api/v1/projects", json={"name": "Abyssal Throne"}).json()
        base = f"/api/v1/projects/{project['id']}"
        season_response = client.post(base + "/seasons", json={"number": 1, "title": "The Beginning"})
        assert season_response.status_code == 201, season_response.text
        season = season_response.json()
        season_base = base + f"/seasons/{season['id']}"
        assert client.post(base + "/seasons", json={"number": 1, "title": "Duplicate"}).status_code == 409
        assert client.post(base + "/seasons", json={"number": 0, "title": "Invalid"}).status_code == 422
        assert client.patch(season_base, json={"title": "  Rise  "}).json()["title"] == "Rise"
        episode_response = client.post(season_base + "/episodes", json={"number": 1, "title": "Awakening"})
        assert episode_response.status_code == 201, episode_response.text
        episode = episode_response.json()
        episode_base = season_base + f"/episodes/{episode['id']}"
        assert client.post(season_base + "/episodes", json={"number": 1, "title": "Duplicate"}).status_code == 409
        assert client.patch(episode_base, json={"synopsis": "The first shot"}).json()["synopsis"] == "The first shot"
        assert len(client.get(season_base + "/episodes").json()) == 1
        assert client.get(base + "/seasons").json()[0]["title"] == "Rise"
        assert client.get("/api/v1/projects/nonexistent/seasons").status_code == 404
        assert client.get(base + "/seasons/nonexistent/episodes").status_code == 404
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        assert client.get(episode_base).json()["synopsis"] == "The first shot"
        assert client.delete(season_base).status_code == 204
        assert client.get(base + "/seasons").json() == []
        assert client.get(episode_base).status_code == 404
        assert client.delete(base).status_code == 204
