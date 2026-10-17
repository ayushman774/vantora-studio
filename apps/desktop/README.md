# Vantora Studio Desktop · Milestone 0.3

## Prerequisites (Windows)

- Node.js 20.19+ or 22.12+ (Vite 6)
- Rust via rustup (stable MSVC toolchain)
- Microsoft C++ Build Tools (Desktop development with C++) and WebView2 Runtime
- Backend Python environment from Milestone 0.2

## Run backend (terminal 1)

```cmd
cd /d E:\vantora-studio\apps\backend
.venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Run desktop (terminal 2)

```cmd
cd /d E:\vantora-studio\apps\desktop
npm install
npm run tauri dev
```

To test just the React UI in a browser: `npm run dev` and visit http://127.0.0.1:1420.

## Milestone scope

- Tauri 2 native window, React 19 + TypeScript, dark application shell, navigation placeholders
- Manual local FastAPI health check; backend is **not** auto-started in this milestone
- No projects, assets, timeline, AI agents, or database writes yet

The health check uses `http://127.0.0.1:8000`. If it appears offline while the backend is running, check CORS configuration for the desktop origin (`http://127.0.0.1:1420` in dev and `tauri://localhost` / `http://tauri.localhost` in production). We will implement a secure native backend lifecycle and stricter CSP before packaging for release.
