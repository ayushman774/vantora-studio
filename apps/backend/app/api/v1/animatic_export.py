"""Local FFmpeg MP4 renderer with per-frame cinematic camera motion and transitions."""
import logging
from pathlib import Path
import shutil
import subprocess
import tempfile
import math
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.storyboards import parents
from app.database.models import StoryboardFrame, Asset, AnimaticAudioClip, AudioAsset, AnimationKeyframe, VisualLayer, VisualLayerKeyframe
from app.services.animation_interpolation import interpolate

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


def apply_keyframe_transform(image, transform):
    """Center-origin inverse affine mapping in output pixels."""
    from PIL import Image
    width, height = image.size
    angle = math.radians(transform.rotation)
    cosine, sine = math.cos(angle), math.sin(angle)
    inverse = 1 / transform.scale
    a, b = cosine * inverse, sine * inverse
    d, e = -sine * inverse, cosine * inverse
    cx, cy = width / 2, height / 2
    tx, ty = transform.position_x, transform.position_y
    coefficients = (a, b, cx - a * (cx + tx) - b * (cy + ty),
                    d, e, cy - d * (cx + tx) - e * (cy + ty))
    backdrop = (7, 11, 18)
    output = image.transform((width, height), Image.Transform.AFFINE, coefficients,
                             resample=Image.Resampling.BICUBIC, fillcolor=backdrop)
    if transform.opacity < 1:
        output = Image.blend(Image.new("RGB", (width, height), backdrop),
                             output, transform.opacity)
    return output



def composite_visual_layers(image, layers, asset_paths, keyframes_by_layer=None, frame_offset=0):
    """Composite ordered RGBA overlays on the 1920x1080 scene.

    Layer position is measured in output pixels. Transparent PNGs retain alpha.
    The storyboard base remains untouched when no layers are visible.
    """
    from PIL import Image
    if not layers:
        return image
    width, height = image.size
    canvas = image.convert("RGBA")
    keyframes_by_layer = keyframes_by_layer or {}
    for layer in sorted(layers, key=lambda item: (item.layer_order, item.id)):
        if not layer.visible:
            continue
        path = asset_paths.get(layer.asset_id)
        if path is None:
            raise OSError("Visual layer references a missing image asset")
        with Image.open(path) as original:
            overlay = original.convert("RGBA")
        # Match preview: contain image within full scene before layer transform.
        ratio = min(width / overlay.width, height / overlay.height)
        dimensions = (max(1, round(overlay.width * ratio)), max(1, round(overlay.height * ratio)))
        overlay = overlay.resize(dimensions, Image.Resampling.LANCZOS)
        scene = Image.new("RGBA", (width, height))
        scene.alpha_composite(overlay, ((width - dimensions[0]) // 2, (height - dimensions[1]) // 2))
        motion = interpolate(keyframes_by_layer[layer.id], frame_offset) if keyframes_by_layer.get(layer.id) else layer
        angle = math.radians(motion.rotation)
        co, si = math.cos(angle), math.sin(angle)
        inv = 1 / motion.scale
        a, b, d, e = co * inv, si * inv, -si * inv, co * inv
        cx, cy = width / 2, height / 2
        tx, ty = motion.position_x, motion.position_y
        matrix = (a, b, cx - a * (cx + tx) - b * (cy + ty),
                  d, e, cy - d * (cx + tx) - e * (cy + ty))
        moved = scene.transform((width, height), Image.Transform.AFFINE, matrix,
                                resample=Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0))
        if motion.opacity < 1:
            alpha = moved.getchannel("A").point(lambda value: round(value * motion.opacity))
            moved.putalpha(alpha)
        canvas = Image.alpha_composite(canvas, moved)
    return canvas.convert("RGB")


def animate_segment(segment: Path, destination: Path, ffmpeg: str, duration: int, keyframes, layers=(), layer_paths=None, layer_keyframes=None) -> None:
    """Stream frames through Pillow without buffering the full shot."""
    from PIL import Image
    import time
    size = 1920 * 1080 * 3
    decoder = subprocess.Popen(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
         "-i", str(segment), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    encoder = subprocess.Popen(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080",
         "-r", str(FPS), "-i", "-", "-frames:v", str(duration),
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination)],
        stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    started = time.monotonic()
    try:
        for offset in range(duration):
            if time.monotonic() - started > 600:
                raise subprocess.TimeoutExpired("animation segment", 600)
            chunks = bytearray()
            while len(chunks) < size:
                part = decoder.stdout.read(size - len(chunks))
                if not part:
                    raise OSError("FFmpeg decoded fewer frames than expected")
                chunks.extend(part)
            image = Image.frombytes("RGB", (1920, 1080), bytes(chunks))
            transformed = apply_keyframe_transform(image, interpolate(keyframes, offset)) if keyframes else image
            if layers:
                transformed = composite_visual_layers(transformed, layers, layer_paths or {}, layer_keyframes, offset)
            encoder.stdin.write(transformed.tobytes())
        encoder.stdin.close()
        if encoder.wait(timeout=120) != 0 or decoder.wait(timeout=120) != 0:
            raise OSError("FFmpeg animation pipeline failed")
    finally:
        if decoder.poll() is None:
            decoder.kill()
        if encoder.poll() is None:
            encoder.kill()
        decoder.wait()
        encoder.wait()
        if decoder.stdout:
            decoder.stdout.close()
        if encoder.stdin and not encoder.stdin.closed:
            encoder.stdin.close()


def render_mp4(sources: list[tuple[Path | None, int, str, int, str, str]], output: Path, ffmpeg: str, keyframes_by_index=None, layers_by_index=None, layer_paths=None, layer_keyframes=None) -> None:
    """Encode deterministic 1080p/24fps segments, then concatenate without re-encoding."""
    with tempfile.TemporaryDirectory(prefix="vantora-render-") as temp:
        workspace = Path(temp)
        segments = []
        keyframes_by_index = keyframes_by_index or {}
        layers_by_index = layers_by_index or {}
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
            keyframes = keyframes_by_index.get(index, [])
            layers = layers_by_index.get(index, [])
            if keyframes or any(layer.visible for layer in layers):
                animated_segment = workspace / f"animated-{index:04d}.mp4"
                animate_segment(segment, animated_segment, ffmpeg, duration, keyframes, layers, layer_paths, layer_keyframes)
                segment = animated_segment
            if transition == "cross-dissolve" and segments:
                still = workspace / f"outgoing-{index:04d}.png"
                previous_duration = sources[index - 1][1]
                subprocess.run([
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-i", str(segments[-1]),
                    "-vf", f"select=eq(n\\,{previous_duration - 1})",
                    "-frames:v", "1", "-update", "1", str(still),
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



def audio_mix_plan(clips, assets, folder, total_frames):
    """Resolve only audio belonging to the current project, clip to shot duration."""
    plan = []
    for clip in clips:
        if clip.muted or clip.volume <= 0 or clip.start_frame >= total_frames:
            continue
        asset = assets.get(clip.audio_asset_id)
        if asset is None:
            raise HTTPException(422, "An audio clip references an unavailable project audio file.")
        path = folder / asset.filename
        if not path.is_file():
            raise HTTPException(422, f"Audio file is missing: {asset.title}")
        duration = min(clip.duration_frames, total_frames - clip.start_frame)
        if duration > 0:
            plan.append((path, clip.start_frame, duration, clip.volume))
    return plan


def mux_audio(video, output, ffmpeg, plan, total_frames):
    """Mix timeline-aligned audio and mux AAC with unchanged H.264 video."""
    inputs, filters, labels = [], [], []
    for index, (path, start, duration, volume) in enumerate(plan):
        inputs.extend(["-i", str(path)])
        filters.append(
            f"[{index + 1}:a]aresample=48000,asetpts=PTS-STARTPTS,"
            f"apad,atrim=duration={duration / FPS:.9f},"
            f"volume={volume:.6f},adelay={round(start * 1000 / FPS)}:all=1[a{index}]"
        )
        labels.append(f"[a{index}]")
    filters.append(
        "".join(labels) +
        f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0,"
        f"atrim=duration={total_frames / FPS:.9f},asetpts=PTS-STARTPTS[aout]"
    )
    subprocess.run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", str(video), *inputs,
        "-filter_complex", ";".join(filters),
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-ar", "48000", "-ac", "2", "-t", f"{total_frames / FPS:.9f}",
        "-movflags", "+faststart", str(output),
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
        frame_ids = [frame.id for frame in frames]
        visual_layers = db.scalars(select(VisualLayer).where(
            VisualLayer.storyboard_frame_id.in_(frame_ids)
        ).order_by(VisualLayer.layer_order)).all()
        layer_ids = {layer.asset_id for layer in visual_layers if layer.visible}
        layer_assets = {a.id: a for a in db.scalars(select(Asset).where(
            Asset.project_id == project_id, Asset.id.in_(layer_ids)
        )).all()}
        asset_folder = request.app.state.data_root / "assets" / project_id
        layer_paths = {}
        for asset_id in layer_ids:
            asset = layer_assets.get(asset_id)
            if asset is None or not asset.media_type.startswith("image/"):
                raise HTTPException(422, "A visual layer references an unavailable project image.")
            path = asset_folder / asset.filename
            if not path.is_file():
                raise HTTPException(422, "A visual layer image is missing on disk.")
            layer_paths[asset_id] = path
        sources = preflight(frames, assets, asset_folder)
        frame_ids = [frame.id for frame in frames]
        keyframes = db.scalars(select(AnimationKeyframe).where(
            AnimationKeyframe.storyboard_frame_id.in_(frame_ids)
        ).order_by(AnimationKeyframe.frame_offset)).all()
        keyframes_by_index = {}
        index_by_id = {frame.id: index for index, frame in enumerate(frames)}
        layers_by_index = {}
        for layer in visual_layers:
            layers_by_index.setdefault(index_by_id[layer.storyboard_frame_id], []).append(layer)
        for keyframe in keyframes:
            keyframes_by_index.setdefault(index_by_id[keyframe.storyboard_frame_id], []).append(keyframe)
        layer_keyframes = {}
        if visual_layers:
            layer_points = db.scalars(select(VisualLayerKeyframe).where(
                VisualLayerKeyframe.visual_layer_id.in_([layer.id for layer in visual_layers])
            ).order_by(VisualLayerKeyframe.frame_offset)).all()
            for point in layer_points:
                layer_keyframes.setdefault(point.visual_layer_id, []).append(point)
        clips = db.scalars(select(AnimaticAudioClip).where(AnimaticAudioClip.shot_id == shot_id).order_by(AnimaticAudioClip.start_frame)).all()
        audio_ids = {clip.audio_asset_id for clip in clips}
        audio_assets = {a.id: a for a in db.scalars(select(AudioAsset).where(AudioAsset.project_id == project_id, AudioAsset.id.in_(audio_ids))).all()}
        total_frames = sum(frame.hold_frames for frame in frames)
        plan = audio_mix_plan(clips, audio_assets, request.app.state.data_root / "audio" / project_id, total_frames)
    exports = request.app.state.data_root / "exports" / project_id
    exports.mkdir(parents=True, exist_ok=True)
    output = exports / f"animatic-{uuid4().hex}.mp4"
    try:
        if plan:
            video_only = exports / f"animatic-video-{uuid4().hex}.mp4"
            try:
                render_mp4(sources, video_only, ffmpeg, keyframes_by_index, layers_by_index, layer_paths, layer_keyframes)
                mux_audio(video_only, output, ffmpeg, plan, total_frames)
            finally:
                video_only.unlink(missing_ok=True)
        else:
            render_mp4(sources, output, ffmpeg, keyframes_by_index, layers_by_index, layer_paths, layer_keyframes)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        output.unlink(missing_ok=True)
        stderr = getattr(exc, "stderr", b"") or b""
        detail = stderr.decode("utf-8", errors="replace")[-3000:] if isinstance(stderr, bytes) else str(stderr)[-3000:]
        logger.error("FFmpeg animatic export failed: %s %s", type(exc).__name__, detail)
        raise HTTPException(500, "Local FFmpeg export failed. See backend terminal for FFmpeg details.") from exc
    return FileResponse(output, media_type="video/mp4", filename=f"vantora-animatic-{shot_id[:8]}.mp4", headers={"Cache-Control": "no-store"})
