"""Interpolation and bounded affine output regression coverage."""
from types import SimpleNamespace
import pytest
from PIL import Image
from app.services.animation_interpolation import Transform, easing, interpolate
from app.api.v1.animatic_export import apply_keyframe_transform

def keyframe(offset, x, mode="linear"):
    return SimpleNamespace(frame_offset=offset, position_x=x, position_y=0,
                           scale=1, rotation=0, opacity=1, easing=mode)

@pytest.mark.parametrize("mode,expected", [
    ("linear", .5), ("ease-in", .25), ("ease-out", .75), ("ease-in-out", .5),
])
def test_easing(mode, expected):
    assert easing(.5, mode) == pytest.approx(expected)

def test_interpolation_clamps_and_uses_outgoing_easing():
    points=[keyframe(0,0,"ease-in"),keyframe(10,100)]
    assert interpolate(points,-2).position_x == 0
    assert interpolate(points,5).position_x == 25
    assert interpolate(points,15).position_x == 100
    assert interpolate([],5) == Transform()
    assert [interpolate(list(reversed(points)),i).position_x for i in (0,5,10)] == [0,25,100]

def test_affine_translation_and_opacity():
    image=Image.new("RGB",(40,40),(255,0,0))
    moved=apply_keyframe_transform(image,Transform(position_x=100))
    assert moved.getpixel((20,20)) == (7,11,18)
    transparent=apply_keyframe_transform(image,Transform(opacity=0))
    assert transparent.getpixel((20,20)) == (7,11,18)
    assert apply_keyframe_transform(image,Transform()).getpixel((20,20)) == (255,0,0)

def test_affine_rotation_is_bounded():
    image=Image.new("RGB",(80,60),(255,0,0))
    output=apply_keyframe_transform(image,Transform(scale=10,rotation=30,position_y=10))
    assert output.size == image.size
