"""Local FFmpeg MP4 renderer with per-frame cinematic camera motion and transitions."""
import logging
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
logger = logging.getLogger(__name__)
FPS = 24
MAX_FRAMES = FPS * 60 * 10  # ten minutes, bounded synchronous export


def preflight(frames: list[StoryboardFrame], assets: dict[str, Asset], folder: Path) -> list[tuple[Path | None, int, str, int, str, str]]:
    if not frames:
        raise HTTPException(422, "Add storyboard frames before exporting.")
    if sum(frame.hold_frames for frame in frames) > MAX_FRAMES:
        raise HTTPException(422, "Export exceeds the ten-minute limit.")
    sources = []
    for frame in frames:
        if frame.transition not in {"cut", "fade", "cross-dissolve"}:
            raise HTTPException(422, "Unsupported transition.")
        asset = assets.get(frame.asset_id or "")
        if asset is None:
            sources.append((None, frame.hold_frames, frame.camera_motion, frame.motion_intensity, frame.motion_easing, frame.transition))
            continue
        path = folder / asset.filename
        if not path.is_file():
            raise HTTPException(422, f"Frame {frame.number} image is missing on disk.")
        sources.append((path, frame.hold_frames, frame.camera_motion, frame.motion_intensity, frame.motion_easing, frame.transition))
    return sources


def camera_filter(duration: int, motion: str, intensity: int, easing: str) -> str:
    """FFmpeg zoompan, matching the preview's eased 12% motion range."""
    if motion == "none" or intensity == 0 or duration <= 1:
        return ("scale=1920:1080:force_original_aspect_ratio=decrease,"
                "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p")
    if motion not in {"zoom-in", "zoom-out", "pan-left", "pan-right"}:
        raise HTTPException(422, "Unsupported camera motion.")
    if easing not in {"linear", "ease-in", "ease-out", "ease-in-out"}:
        raise HTTPException(422, "Unsupported motion easing.")
    if not 0 <= intensity <= 200:
        raise HTTPException(422, "Motion intensity must be between 0 and 200.")
    p = f"(on/{duration - 1})"
    eased = {
        "linear": p,
        "ease-in": f"({p}*{p})",
        "ease-out": f"(1-(1-{p})*(1-{p}))",
        "ease-in-out": f"({p}*{p}*(3-2*{p}))",
    }[easing]
    amount = 0.12 * intensity / 100
    if motion == "zoom-in":
        zoom = f"(1+{amount:.6f}*{eased})"
    elif motion == "zoom-out":
        zoom = f"(1+{amount:.6f}*(1-{eased}))"
    else:
        zoom = f"{1 + amount:.6f}"
    # The preview pans from one edge to the other over a slightly enlarged image.
    if motion == "pan-left":
        x = f"((iw-iw/zoom)*(1-{eased}))"
    elif motion == "pan-right":
        x = f"((iw-iw/zoom)*{eased})"
    else:
        x = "(iw-iw/zoom)/2"
    return (
        "scale=1920:1080:force_original_aspect_ratio=increase,"
        "crop=1920:1080,scale=2304:1296,"
        f"zoompan=z='{zoom}':x='{x}':y='(ih-ih/zoom)/2':"
        f"d={duration}:s=1920x1080:fps={FPS},setsar=1,format=yuv420p"
    )


def dissolve_frames(duration: int) -> int:
    return min(8, max(1, duration // 3))


def fade_filter(duration: int) -> str:
    length = max(1, min(8, duration // 4))
    return (f",fade=t=in:s=0:n={length},"
            f"fade=t=out:s={max(0, duration - length)}:n={length}")


def render_mp4(sources: list[tuple[Path | None, int, str, int, str, str]], output: Path, ffmpeg: str) -> None:
    """Encode deterministic 1080p/24fps segments, then concatenate without re-encoding."""
    with tempfile.TemporaryDirectory(prefix="vantora-render-") as temp:
        workspace = Path(temp)
        segments = []
        for index, (source, duration, motion, intensity, easing, transition) in enumerate(sources):
            segment = workspace / f"part-{index:04d}.mp4"
            input_args = (
                ["-f", "lavfi", "-i", f"color=c=0x161a20:s=1920x1080:r={FPS}"]
                if source is None else
                ["-loop", "1", "-framerate", str(FPS), "-i", str(source)]
            )
            vf = camera_filter(duration, motion, intensity, easing) if source else camera_filter(duration, "none", 0, "linear")
            if transition == "fade":
                vf += fade_filter(duration)
            cmd = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                *input_args,
                "-vf", vf,
                "-frames:v", str(duration), "-an", "-c:v", "libx264",
                "-preset", "veryfast", "-crf", "20", "-r", str(FPS),
                "-movflags", "+faststart", str(segment),
            ]
            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
            if transition == "cross-dissolve" and segments:
                still = workspace / f"outgoing-{index:04d}.png"
                previous_duration = sources[index - 1][1]
                subprocess.run([
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-i", str(segments[-1]),
                    "-vf", f"select=eq(n\\,{previous_duration - 1})",
                    "-vsync", "vfr", "-frames:v", "1", str(still),
                ], check=True, capture_output=True, timeout=600)
                blended = workspace / f"blended-{index:04d}.mp4"
                length = dissolve_frames(duration)
                alpha = f"min(1,(N+1)/({length}+1))"
                expression = f"A*(1-{alpha})+B*{alpha}"
                subprocess.run([
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-loop", "1", "-framerate", str(FPS), "-i", str(still),
                    "-i", str(segment),
                    "-filter_complex", f"[0:v][1:v]blend=all_expr='{expression}',format=yuv420p[v]",
                    "-map", "[v]", "-frames:v", str(duration), "-an",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-r", str(FPS), "-movflags", "+faststart", str(blended),
                ], check=True, capture_output=True, timeout=600)
                segment = blended
            segments.append(segment)
        # FFmpeg concat files require single-quote escaping; segment paths are
        # generated under our own temporary directory rather than user input.
        manifest = workspace / "segments.txt"
        manifest.write_text("".join("file '" + segment.name + "'\n" for segment in segments), encoding="utf-8")
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
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        output.unlink(missing_ok=True)
        stderr = getattr(exc, "stderr", b"") or b""
        detail = stderr.decode("utf-8", errors="replace")[-3000:] if isinstance(stderr, bytes) else str(stderr)[-3000:]
        logger.error("FFmpeg animatic export failed: %s %s", type(exc).__name__, detail)
        raise HTTPException(500, "Local FFmpeg export failed. See backend terminal for FFmpeg details.") from exc
    return FileResponse(output, media_type="video/mp4", filename=f"vantora-animatic-{shot_id[:8]}.mp4", headers={"Cache-Control": "no-store"})
