"""Devlofy brand marks - every surface that is not an app icon.

    python tools/brand/make-marks.py

Reads `assets/brand/devlofy-logo.png` (the supplied 1024x1024 artwork, drawn
flat over white) and writes the marks the rest of the product uses:

    assets/brand/devlofy-mark.png        transparent mark, for light surfaces
    assets/brand/devlofy-mark-light.png  white silhouette, for dark surfaces
    assets/images/splash-icon.png        splash mark, light scheme
    assets/images/splash-icon-light.png  splash mark, dark scheme
    site/assets/brand/mark.png           the landing page's header mark
    site/assets/brand/mark-night.png     the social-card mark (white)

The un-mix is the same projection `make-icons.py` uses: every pixel of the flat
artwork is resolved back into (colour, coverage) exactly, so a mark cut out of
the white canvas carries no grey halo. Idempotent.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "assets" / "brand" / "devlofy-logo.png"

PALETTE = np.array([[99, 51, 251], [29, 25, 44]], dtype=np.float64)
WHITE = np.array([1.0, 1.0, 1.0])

# Outputs: (path, canvas, mark_width, recolour)
OUTPUTS = [
    (REPO / "assets/brand/devlofy-mark.png", 512, 0.94, None),
    (REPO / "assets/brand/devlofy-mark-light.png", 512, 0.94, (1.0, 1.0, 1.0)),
    (REPO / "assets/images/splash-icon.png", 256, 0.62, None),
    (REPO / "assets/images/splash-icon-light.png", 256, 0.62, (1.0, 1.0, 1.0)),
    (REPO / "site/assets/brand/mark.png", 192, 0.94, None),
    (REPO / "site/assets/brand/mark-night.png", 192, 0.94, (1.0, 1.0, 1.0)),
]


def read_mark(path):
    """Un-mix the artwork into exact (colour, coverage) and crop to the mark."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0

    best_residual = np.full(rgb.shape[:2], np.inf)
    best_colour = np.zeros_like(rgb)
    best_alpha = np.zeros(rgb.shape[:2])

    for colour in PALETTE / 255.0:
        v = colour - WHITE
        alpha = np.clip(((rgb - WHITE) @ v) / (v @ v), 0.0, 1.0)
        residual = np.linalg.norm(rgb - (WHITE + alpha[..., None] * v), axis=-1)
        take = residual < best_residual
        best_residual = np.where(take, residual, best_residual)
        best_alpha = np.where(take, alpha, best_alpha)
        best_colour = np.where(take[..., None], colour, best_colour)

    rgba = np.concatenate([best_colour, best_alpha[..., None]], axis=-1)
    ys, xs = np.where(best_alpha > 0.02)
    if len(xs) == 0:
        raise SystemExit(f"no mark found in {path}")
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return rgba[box[1] : box[3], box[0] : box[2]]


def resize_premultiplied(rgba, width):
    """Scale by width, keeping the edge colours from bleeding into the alpha."""
    height = max(1, round(rgba.shape[0] * width / rgba.shape[1]))
    premultiplied = rgba.copy()
    premultiplied[..., :3] *= premultiplied[..., 3:4]
    image = Image.fromarray(np.round(premultiplied * 255).astype(np.uint8), "RGBA")
    image = image.resize((width, height), Image.LANCZOS)
    scaled = np.asarray(image, dtype=np.float64) / 255.0
    alpha = scaled[..., 3:4]
    colour = np.divide(
        scaled[..., :3], alpha, out=np.zeros_like(scaled[..., :3]), where=alpha > 1e-4
    )
    return np.clip(np.concatenate([colour, alpha], axis=-1), 0.0, 1.0)


def save(array, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    pixels = np.round(np.clip(array, 0.0, 1.0) * 255).astype(np.uint8)
    Image.fromarray(pixels).save(path, optimize=True)
    print(f"     {path.relative_to(REPO)}  {path.stat().st_size / 1024:6.1f} KB")


def main():
    mark = read_mark(SRC)
    height, width = mark.shape[:2]
    print(f"mark {width}x{height} from {SRC.relative_to(REPO)}")

    for path, canvas, share, recolour in OUTPUTS:
        scaled = resize_premultiplied(mark, round(canvas * share))
        out = np.zeros((canvas, canvas, 4), dtype=np.float64)
        h, w = scaled.shape[:2]
        top = (canvas - h) // 2
        left = (canvas - w) // 2
        out[top : top + h, left : left + w] = scaled
        if recolour is not None:
            out[..., 0] = recolour[0]
            out[..., 1] = recolour[1]
            out[..., 2] = recolour[2]
            # Keep the alpha as coverage; the silhouette stays one colour.
        save(out, path)


if __name__ == "__main__":
    main()
