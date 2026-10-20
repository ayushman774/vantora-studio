"""Regression tests for frame-aligned MP4 audio mix planning."""
from types import SimpleNamespace
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.v1.animatic_export import audio_mix_plan, mux_audio


def test_audio_plan_respects_start_duration_mute_and_end(tmp_path: Path):
    (tmp_path / "music.wav").write_bytes(b"RIFF")
    assets = {"music": SimpleNamespace(filename="music.wav", title="Music")}
    def clip(start, duration, muted=False, volume=1.0, asset="music"):
        return SimpleNamespace(audio_asset_id=asset, start_frame=start, duration_frames=duration, muted=muted, volume=volume)
    plan = audio_mix_plan([clip(0, 264), clip(240, 100, volume=0.5), clip(0, 24, muted=True), clip(264, 24)], assets, tmp_path, 264)
    assert plan == [(tmp_path / "music.wav", 0, 264, 1.0), (tmp_path / "music.wav", 240, 24, 0.5)]


def test_missing_audio_is_validation_error(tmp_path: Path):
    clips = [SimpleNamespace(audio_asset_id="missing", start_frame=0, duration_frames=24, muted=False, volume=1)]
    with pytest.raises(HTTPException) as exc:
        audio_mix_plan(clips, {}, tmp_path, 24)
    assert exc.value.status_code == 422


def test_mux_uses_aac_and_keeps_video(monkeypatch, tmp_path: Path):
    captured = {}
    def fake_run(args, **kwargs):
        captured["args"] = args
    monkeypatch.setattr("app.api.v1.animatic_export.subprocess.run", fake_run)
    mux_audio(tmp_path / "video.mp4", tmp_path / "out.mp4", "ffmpeg", [(tmp_path / "music.wav", 48, 72, 0.5)], 264)
    args = captured["args"]
    assert args[args.index("-c:v") + 1] == "copy"
    assert args[args.index("-c:a") + 1] == "aac"
    assert "adelay=2000:all=1" in args[args.index("-filter_complex") + 1]
    assert "volume=0.500000" in args[args.index("-filter_complex") + 1]
