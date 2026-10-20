"""Export preflight regressions; no FFmpeg binary required for these tests."""
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.api.v1.animatic_export import preflight, camera_filter, dissolve_frames, fade_filter, FPS, MAX_FRAMES


def frame(**changes):
    values = dict(number=1, hold_frames=48, camera_motion="none", transition="cut", asset_id="a", motion_intensity=100, motion_easing="linear")
    values.update(changes)
    return SimpleNamespace(**values)


def test_preflight_valid_static_cut(tmp_path):
    (tmp_path / "ref.png").write_bytes(b"test")
    asset = SimpleNamespace(filename="ref.png")
    assert preflight([frame()], {"a": asset}, tmp_path) == [(tmp_path / "ref.png", 48, "none", 100, "linear", "cut")]


@pytest.mark.parametrize("frames", [
    [], [frame(transition="invalid")],
    [frame(hold_frames=MAX_FRAMES+1)],
])
def test_preflight_rejects_unsupported_or_missing(frames, tmp_path):
    with pytest.raises(HTTPException) as error:
        preflight(frames, {}, tmp_path)
    assert error.value.status_code == 422


def test_preflight_rejects_missing_disk_file(tmp_path):
    with pytest.raises(HTTPException) as error:
        preflight([frame()], {"a": SimpleNamespace(filename="missing.png")}, tmp_path)
    assert error.value.status_code == 422


def test_preflight_allows_missing_image_as_placeholder(tmp_path):
    assert preflight([frame(asset_id=None)], {}, tmp_path) == [(None, 48, "none", 100, "linear", "cut")]


def test_preflight_preserves_order_with_placeholder(tmp_path):
    (tmp_path / "ref.png").write_bytes(b"test")
    frames = [frame(number=1, hold_frames=24), frame(number=2, asset_id=None, hold_frames=72)]
    assert preflight(frames, {"a": SimpleNamespace(filename="ref.png")}, tmp_path) == [
        (tmp_path / "ref.png", 24, "none", 100, "linear", "cut"), (None, 72, "none", 100, "linear", "cut"),
    ]


@pytest.mark.parametrize("motion", ["zoom-in", "zoom-out", "pan-left", "pan-right"])
@pytest.mark.parametrize("easing", ["linear", "ease-in", "ease-out", "ease-in-out"])
def test_camera_filter_supports_motion_and_easing(motion, easing):
    result = camera_filter(48, motion, 125, easing)
    assert "zoompan=" in result
    assert "d=48" in result
    assert "fps=24" in result


def test_preflight_accepts_motion_with_cut(tmp_path):
    result = preflight([frame(asset_id=None, camera_motion="zoom-in", motion_intensity=175, motion_easing="ease-out")], {}, tmp_path)
    assert result == [(None, 48, "zoom-in", 175, "ease-out", "cut")]


@pytest.mark.parametrize("transition", ["fade", "cross-dissolve"])
def test_preflight_accepts_transitions(transition, tmp_path):
    assert preflight([frame(asset_id=None, transition=transition)], {}, tmp_path) == [
        (None, 48, "none", 100, "linear", transition)
    ]


def test_transition_lengths_do_not_extend_timeline():
    assert dissolve_frames(48) == 8
    assert dissolve_frames(3) == 1
    assert "fade=t=in" in fade_filter(48)
    assert "fade=t=out" in fade_filter(48)
