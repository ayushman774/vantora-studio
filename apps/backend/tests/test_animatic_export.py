"""Export preflight regressions; no FFmpeg binary required for these tests."""
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.api.v1.animatic_export import preflight, FPS, MAX_FRAMES


def frame(**changes):
    values = dict(number=1, hold_frames=48, camera_motion="none", transition="cut", asset_id="a")
    values.update(changes)
    return SimpleNamespace(**values)


def test_preflight_valid_static_cut(tmp_path):
    (tmp_path / "ref.png").write_bytes(b"test")
    asset = SimpleNamespace(filename="ref.png")
    assert preflight([frame()], {"a": asset}, tmp_path) == [(tmp_path / "ref.png", 48)]


@pytest.mark.parametrize("frames", [
    [], [frame(camera_motion="zoom-in")], [frame(transition="fade")],
    [frame(transition="cross-dissolve")], [frame(asset_id=None)],
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
