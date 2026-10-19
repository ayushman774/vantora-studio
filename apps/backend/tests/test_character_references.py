"""Local image reference persistence, validation, and isolation."""
from pathlib import Path
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app

PNG = (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00\x00\x00\x01\x00\x00\x00\x01" + b"\x08\x02\x00\x00\x00" + b"\x90wS\xde" + b"\x00\x00\x00\x0cIDAT" + b"\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00" + b"\xc9\xfe\x92\xef" + b"\x00\x00\x00\x00IEND\xaeB\x60\x82")

def test_character_reference_images(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA_ROOT", str(tmp_path))
    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(cfg, "head")
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        p1 = client.post("/api/v1/projects", json={"name": "First"}).json()["id"]
        p2 = client.post("/api/v1/projects", json={"name": "Second"}).json()["id"]
        c1 = client.post(f"/api/v1/projects/{p1}/characters", json={"name": "Test"}).json()["id"]
        c2 = client.post(f"/api/v1/projects/{p2}/characters", json={"name": "Other"}).json()["id"]
        base = f"/api/v1/projects/{p1}/characters/{c1}/references"
        other = f"/api/v1/projects/{p2}/characters/{c2}/references"
        upload = client.post(base, content=PNG, headers={"Content-Type": "image/png", "X-Filename": "test.png"})
        assert upload.status_code == 201, upload.text
        ref = upload.json()
        assert ref["size_bytes"] == len(PNG)
        assert ref["original_name"] == "test.png"
        assert client.get(base).json()[0]["id"] == ref["id"]
        assert client.get(f"{base}/{ref['id']}/image").content == PNG
        assert client.get(f"{other}/{ref['id']}/image").status_code == 404
        assert client.delete(f"{other}/{ref['id']}").status_code == 404
        assert client.post(base, content=b"not an image", headers={"Content-Type": "image/png"}).status_code == 422
        assert client.post(base, content=PNG, headers={"Content-Type": "application/pdf"}).status_code == 415
        assert client.post(base, content=b"x" * (10 * 1024 * 1024 + 1), headers={"Content-Type": "image/png"}).status_code == 413
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        assert client.get(f"{base}/{ref['id']}/image").content == PNG
        assert client.delete(f"{base}/{ref['id']}").status_code == 204
        assert client.get(base).json() == []
        assert client.get(f"{base}/{ref['id']}/image").status_code == 404
