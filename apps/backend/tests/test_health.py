from fastapi.testclient import TestClient
from app.main import create_app
from app.core.config import Settings


def test_health_endpoint_returns_ready(tmp_path):
    app = create_app(Settings(data_root=tmp_path))
    with TestClient(app) as client:
        response = client.get("/api/v1/system/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ready", "studio": "Vantora Studio", "database": "healthy", "version": "0.1.0"
        }
        assert (tmp_path / "studio.db").exists()


def test_unknown_route_returns_404(tmp_path):
    with TestClient(create_app(Settings(data_root=tmp_path))) as client:
        assert client.get("/api/v1/unknown").status_code == 404
