# Vantora Studio
Private, local-first creative production studio.

## Backend development

```powershell
cd apps/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m pytest -q
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/api/v1/system/health

Milestone 0 foundation only. Database migrations and Tauri lifecycle integration are next; no domain tables have been created.
