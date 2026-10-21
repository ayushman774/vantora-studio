"""Deterministic 24 FPS keyframe interpolation shared by export planning.

Offsets are relative to the storyboard frame's hold; the outgoing keyframe
owns easing for its segment, matching the desktop preview.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class Transform:
    position_x: float = 0.0
    position_y: float = 0.0
    scale: float = 1.0
    rotation: float = 0.0
    opacity: float = 1.0

FIELDS = ("position_x", "position_y", "scale", "rotation", "opacity")

def easing(progress: float, kind: str) -> float:
    t = max(0.0, min(1.0, progress))
    if kind == "ease-in":
        return t * t
    if kind == "ease-out":
        return 1 - (1 - t) * (1 - t)
    if kind == "ease-in-out":
        return t * t * (3 - 2 * t)
    return t

def interpolate(keyframes, offset: int) -> Transform:
    if not keyframes:
        return Transform()
    ordered = sorted(keyframes, key=lambda item: item.frame_offset)
    if offset <= ordered[0].frame_offset:
        return Transform(**{name: getattr(ordered[0], name) for name in FIELDS})
    if offset >= ordered[-1].frame_offset:
        return Transform(**{name: getattr(ordered[-1], name) for name in FIELDS})
    for left, right in zip(ordered, ordered[1:]):
        if left.frame_offset <= offset <= right.frame_offset:
            t = easing((offset - left.frame_offset) / (right.frame_offset - left.frame_offset), left.easing)
            return Transform(**{
                name: getattr(left, name) + (getattr(right, name) - getattr(left, name)) * t
                for name in FIELDS
            })
    raise AssertionError("Unreachable keyframe interval")
