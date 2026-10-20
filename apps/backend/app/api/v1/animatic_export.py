"""Local FFmpeg MP4 renderer: initial cut-only, static-frame export pipeline.

Advanced camera and blend rendering is deliberately rejected until implemented.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.storyboards import parents
from app.database.models import StoryboardFrame, Asset

router = APIRouter(
    prefix="/projects/{project_id}/seasons/{season_id}/episodes/{episode_id}/scenes/{scene_id}/shots/{shot_id}",
    tags=["Animatic Export"],
)
FPS = 24
MAX_FRAMES = FPS * 60 * 10  # ten minutes, bounded synchronous export


def preflight(frames: list[StoryboardFrame], assets: dict[str, Asset], folder: Path) -> list[tuple[Path | None, int]]:
    if not frames:
        raise HTTPException(422, "Add storyboard frames before exporting.")
    if sum(frame.hold_frames for frame in frames) > MAX_FRAMES:
        raise HTTPException(422, "Export exceeds the ten-minute limit.")
    sources = []
    for frame in frames:
        if frame.camera_motion != "none" or frame.transition != "cut":
            raise HTTPException(422, "This first export version supports static frames with cut transitions only. Motion and blends are coming next.")
        asset = assets.get(frame.asset_id or "")
        if asset is None:
            sources.append((None, frame.hold_frames))
            continue
        path = folder / asset.filename
        if not path.is_file():
            raise HTTPException(422, f"Frame {frame.number} image is missing on disk.")
        sources.append((path, frame.hold_frames))
    return sources


def render_mp4(sources: list[tuple[Path | None, int]], output: Path, ffmpeg: str) -> None:
    """Encode deterministic 1080p/24fps segments, then concatenate without re-encoding."""
    with tempfile.TemporaryDirectory(prefix="vantora-render-") as temp:
        workspace = Path(temp)
        segments = []
        for index, (source, duration) in enumerate(sources):
            segment = workspace / f"part-{index:04d}.mp4"
            input_args = (
                ["-f", "lavfi", "-i", f"color=c=0x161a20:s=1920x1080:r={FPS}"]
                if source is None else
                ["-loop", "1", "-framerate", str(FPS), "-i", str(source)]
            )
            cmd = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                *input_args,
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,"
                       "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p",
                "-frames:v", str(duration), "-an", "-c:v", "libx264",
                "-preset", "veryfast", "-crf", "20", "-r", str(FPS),
                "-movflags", "+faststart", str(segment),
            ]
            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
            segments.append(segment)
        # FFmpeg concat files require single-quote escaping; segment paths are
        # generated under our own temporary directory rather than user input.
        manifest = workspace / "segments.txt"
        manifest.write_text("".join(f"file 'part-{i:04d}.mp4'\n" for i in range(len(segments))), encoding="utf-8")
        subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-f", "concat", "-safe", "1", "-i", str(manifest),
            "-c", "copy", "-movflags", "+faststart", str(output),
        ], check=True, capture_output=True, timeout=600)


@router.post("/animatic-export")
def export_animatic(project_id: str, season_id: str, episode_id: str, scene_id: str, shot_id: str, request: Request):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(503, "FFmpeg not found on PATH. Install FFmpeg and restart the backend.")
    with Session(request.app.state.engine) as db:
        parents(db, project_id, season_id, episode_id, scene_id, shot_id)
        frames = db.scalars(select(StoryboardFrame).where(StoryboardFrame.shot_id == shot_id).order_by(StoryboardFrame.number)).all()
        ids = {f.asset_id for f in frames if f.asset_id}
        assets = {a.id: a for a in db.scalars(select(Asset).where(Asset.project_id == project_id, Asset.id.in_(ids))).all()}
        sources = preflight(frames, assets, request.app.state.data_root / "assets" / project_id)
    exports = request.app.state.data_root / "exports" / project_id
    exports.mkdir(parents=True, exist_ok=True)
    output = exports / f"animatic-{uuid4().hex}.mp4"
    try:
        render_mp4(sources, output, ffmpeg)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        output.unlink(missing_ok=True)
        raise HTTPException(500, "Local FFmpeg export failed. Check image files and FFmpeg installation.")
    return FileResponse(output, media_type="video/mp4", filename=f"vantora-animatic-{shot_id[:8]}.mp4", headers={"Cache-Control": "no-store"})
