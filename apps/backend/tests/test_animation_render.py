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


def test_visual_layer_compositing_preserves_base_and_transparency(tmp_path):
    from app.api.v1.animatic_export import composite_visual_layers
    image = Image.new("RGB", (100, 60), (10, 20, 30))
    overlay = Image.new("RGBA", (20, 20), (255, 0, 0, 0))
    for x in range(5, 15):
        for y in range(5, 15):
            overlay.putpixel((x, y), (255, 0, 0, 255))
    path = tmp_path / "hero.png"
    overlay.save(path)
    layer = SimpleNamespace(id="layer", asset_id="hero", layer_order=1, visible=True,
                            opacity=1, position_x=0, position_y=0, rotation=0, scale=1)
    output = composite_visual_layers(image, [layer], {"hero": path})
    assert output.getpixel((0, 0)) == (10, 20, 30)
    assert output.getpixel((50, 30)) == (255, 0, 0)
    assert composite_visual_layers(image, [layer], {"hero": path}).size == image.size
    layer.visible = False
    assert composite_visual_layers(image, [layer], {"hero": path}).getpixel((50, 30)) == (10, 20, 30)


def test_visual_layer_opacity_and_order(tmp_path):
    from app.api.v1.animatic_export import composite_visual_layers
    background = Image.new("RGB", (80, 60), (0, 0, 255))
    paths = {}
    for key, color in (("a", (255, 0, 0, 255)), ("b", (0, 255, 0, 255))):
        path = tmp_path / (key + ".png")
        Image.new("RGBA", (80, 60), color).save(path)
        paths[key] = path
    def layer(key, order, opacity=1):
        return SimpleNamespace(id=key, asset_id=key, layer_order=order, visible=True,
                               opacity=opacity, position_x=0, position_y=0, rotation=0, scale=1)
    output = composite_visual_layers(background, [layer("b", 2), layer("a", 1)], paths)
    assert output.getpixel((40, 30)) == (0, 255, 0)
    faded = composite_visual_layers(background, [layer("a", 1, 0.5)], paths)
    red, green, blue = faded.getpixel((40, 30))
    assert 120 <= red <= 135 and green == 0 and 120 <= blue <= 135


def test_independent_layer_keyframes_move_only_selected_layer(tmp_path):
    from app.api.v1.animatic_export import composite_visual_layers
    base = Image.new("RGB", (100, 60), (15, 20, 25))
    stationary = tmp_path / "background.png"
    moving = tmp_path / "character.png"
    Image.new("RGBA", (100, 60), (0, 0, 200, 255)).save(stationary)
    artwork = Image.new("RGBA", (100, 60), (0, 0, 0, 0))
    for x in range(45, 55):
        for y in range(25, 35):
            artwork.putpixel((x, y), (255, 0, 0, 255))
    artwork.save(moving)
    background = SimpleNamespace(id="bg", asset_id="bg", layer_order=0, visible=True,
                                 opacity=1, position_x=0, position_y=0, rotation=0, scale=1)
    character = SimpleNamespace(id="hero", asset_id="hero", layer_order=1, visible=True,
                                opacity=1, position_x=0, position_y=0, rotation=0, scale=1)
    points = {"hero": [keyframe(0, -20), keyframe(10, 20)]}
    paths = {"bg": stationary, "hero": moving}
    first = composite_visual_layers(base, [background, character], paths, points, 0)
    middle = composite_visual_layers(base, [background, character], paths, points, 5)
    last = composite_visual_layers(base, [background, character], paths, points, 10)
    assert first.getpixel((30, 30)) == (255, 0, 0)
    assert middle.getpixel((50, 30)) == (255, 0, 0)
    assert last.getpixel((70, 30)) == (255, 0, 0)
    assert all(frame.getpixel((5, 5)) == (0, 0, 200) for frame in (first, middle, last))


def test_layer_keyframe_opacity_can_animate_from_zero(tmp_path):
    from app.api.v1.animatic_export import composite_visual_layers
    base = Image.new("RGB", (40, 40), (0, 0, 255))
    path = tmp_path / "red.png"
    Image.new("RGBA", (40, 40), (255, 0, 0, 255)).save(path)
    layer = SimpleNamespace(id="hero", asset_id="hero", layer_order=0, visible=True,
                            opacity=0, position_x=0, position_y=0, rotation=0, scale=1)
    def point(offset, opacity):
        return SimpleNamespace(frame_offset=offset, position_x=0, position_y=0,
                               scale=1, rotation=0, opacity=opacity, easing="linear")
    points = {"hero": [point(0, 0), point(10, 1)]}
    first = composite_visual_layers(base, [layer], {"hero": path}, points, 0)
    last = composite_visual_layers(base, [layer], {"hero": path}, points, 10)
    assert first.getpixel((20, 20)) == (0, 0, 255)
    assert last.getpixel((20, 20)) == (255, 0, 0)
