"""Devlofy app icons - generated from the one source mark.

    python tools/brand/make-icons.py

Reads `assets/brand/devlofy-logo.png` (the supplied 1024x1024 artwork) and
writes every icon `app.json` declares:

    assets/images/icon.png                    1024   iOS, Android fallback, web
    assets/images/favicon.png                   64   browser tab
    assets/images/android-icon-foreground.png 1024   adaptive foreground (alpha)
    assets/images/android-icon-monochrome.png 1024   themed-icon silhouette

Conventions
-----------
* The artwork is flat: one brand purple and one ink, drawn over pure white. So
  every pixel is un-mixed back into (colour, coverage) exactly, by projection
  onto each ink's line from white - no thresholding, and no grey halo where an
  edge was antialiased against the white.
* Resampling happens in premultiplied alpha. Pillow's own RGBA resize averages
  the colour of fully transparent pixels into the edge, which fringes a shape
  cut out of a flat background.
* `icon.png` is written RGB with no alpha channel: the App Store rejects a 1024
  icon that carries one.
* The adaptive foreground keeps every pixel inside the 72/108 dp mask circle.
  A wide mark has to be noticeably smaller than its bounding square to survive
  a round launcher icon, and `verify()` fails the run if the maths slips.

Idempotent: re-running rewrites the same four files from the same source.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "assets" / "brand" / "devlofy-logo.png"
OUT = REPO / "assets" / "images"

# The two flat colours the mark is drawn with. Un-mixing needs to know what was
# drawn, so these are measured from the source rather than sampled per pixel.
PALETTE = np.array([[99, 51, 251], [29, 25, 44]], dtype=np.float64)

ICON_SIZE = 1024
FAVICON_SIZE = 64

# How much of the canvas the mark's width fills.
ICON_MARK = 0.76
FAVICON_MARK = 0.86

# Android renders a 108 dp canvas through a mask no larger than 72 dp, so the
# mark must fit the circle inscribed in that square (a little inside it).
ADAPTIVE_VISIBLE = 72 / 108
ADAPTIVE_MARGIN = 0.97

WHITE = np.array([1.0, 1.0, 1.0])


def read_mark(path):
    """Un-mix the artwork into exact (colour, coverage) and crop to the mark."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    white = 255.0

    best_residual = np.full(rgb.shape[:2], np.inf)
    best_colour = np.zeros_like(rgb)
    best_alpha = np.zeros(rgb.shape[:2])

    for colour in PALETTE:
        v = colour - white
        alpha = np.clip(((rgb - white) @ v) / (v @ v), 0.0, 1.0)
        residual = np.linalg.norm(rgb - (white + alpha[..., None] * v), axis=-1)
        take = residual < best_residual
        best_residual = np.where(take, residual, best_residual)
        best_alpha = np.where(take, alpha, best_alpha)
        best_colour = np.where(take[..., None], colour, best_colour)

    rgba = np.concatenate([best_colour / 255.0, best_alpha[..., None]], axis=-1)

    alpha = rgba[..., 3]
    ys, xs = np.where(alpha > 0.02)
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


def compose(mark, size, background):
    """Centre the mark on a square canvas of `background` (RGB, 0..1)."""
    canvas = np.zeros((size, size, 3), dtype=np.float64)
    canvas[:] = background
    height, width = mark.shape[:2]
    top = (size - height) // 2
    left = (size - width) // 2

    alpha = mark[..., 3:4]
    patch = canvas[top : top + height, left : left + width]
    patch[:] = mark[..., :3] * alpha + patch * (1.0 - alpha)
    return canvas


def stamp(mark, size, colour=None):
    """Centre the mark on a transparent square canvas."""
    canvas = np.zeros((size, size, 4), dtype=np.float64)
    height, width = mark.shape[:2]
    top = (size - height) // 2
    left = (size - width) // 2
    canvas[top : top + height, left : left + width] = mark
    if colour is not None:
        canvas[..., :3] = colour
    return canvas


def save(array, path, with_alpha):
    pixels = np.round(np.clip(array, 0.0, 1.0) * 255).astype(np.uint8)
    if not with_alpha:
        pixels = pixels[..., :3]
    Image.fromarray(pixels).save(path, optimize=True)


def adaptive_width(mark, size):
    """Widest the mark can be and still fit the round launcher mask."""
    height, width = mark.shape[:2]
    aspect = width / height
    visible = ADAPTIVE_VISIBLE * size * ADAPTIVE_MARGIN
    return round(visible * aspect / np.sqrt(1.0 + aspect * aspect))


def verify():
    """Assert what the store rules and the launcher actually check."""
    problems = []

    def check(name, condition, detail):
        print(f"{'ok  ' if condition else 'FAIL'} {name}{'' if condition else ' - ' + detail}")
        if not condition:
            problems.append(name)

    def load(name):
        return np.asarray(Image.open(OUT / name).convert("RGBA"), dtype=np.float64) / 255.0

    def drawn_width(rgba, background=None):
        """Width of the ink: by alpha on a cut-out, by distance from the background."""
        if background is None:
            ink = rgba[..., 3] > 0.02
        else:
            ink = np.linalg.norm(rgba[..., :3] - background, axis=-1) > 0.05
        columns = np.where(ink.any(axis=0))[0]
        return columns.max() - columns.min() + 1

    icon = Image.open(OUT / "icon.png")
    check("icon is 1024 square", icon.size == (ICON_SIZE, ICON_SIZE), str(icon.size))
    check("icon has no alpha channel", icon.mode == "RGB", icon.mode)
    check(
        "icon is opaque white in the corners",
        icon.getpixel((0, 0)) == (255, 255, 255) and icon.getpixel((1023, 1023)) == (255, 255, 255),
        str(icon.getpixel((0, 0))),
    )
    drawn = drawn_width(load("icon.png"), WHITE)
    check(
        "icon mark is the declared share of the canvas",
        abs(drawn - ICON_MARK * ICON_SIZE) <= 2,
        f"mark is {drawn}px, wanted {ICON_MARK * ICON_SIZE:.0f}px",
    )

    favicon = Image.open(OUT / "favicon.png")
    check("favicon is 64 square", favicon.size == (FAVICON_SIZE, FAVICON_SIZE), str(favicon.size))
    check(
        "favicon is not blank",
        np.count_nonzero(np.asarray(favicon.convert("RGB")) < 200) > 200,
        "the tab icon has almost no ink in it",
    )

    foreground = load("android-icon-foreground.png")
    alpha = foreground[..., 3]
    check(
        "foreground is transparent at the corners",
        max(alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]) < 0.01,
        "corner is opaque",
    )
    ys, xs = np.where(alpha > 0.02)
    centre = (ICON_SIZE - 1) / 2
    reach = np.max(np.hypot(xs - centre, ys - centre))
    limit = ADAPTIVE_VISIBLE * ICON_SIZE / 2
    check(
        "foreground sits inside the 72/108 dp mask circle",
        reach <= limit,
        f"reaches {reach:.1f}px, the mask ends at {limit:.1f}px",
    )

    monochrome = load("android-icon-monochrome.png")
    ink = monochrome[monochrome[..., 3] > 0.99][:, :3]
    check(
        "monochrome is one colour",
        len(ink) > 0 and np.allclose(ink, ink[0]),
        "the silhouette has more than one colour",
    )
    check(
        "monochrome is transparent at the corners",
        max(monochrome[0, 0, 3], monochrome[-1, -1, 3]) < 0.01,
        "corner is opaque",
    )
    same_shape = (foreground[..., 3] > 0.5) == (monochrome[..., 3] > 0.5)
    check(
        "monochrome covers exactly the foreground shape",
        same_shape.mean() > 0.999,
        f"{100 * (1 - same_shape.mean()):.2f}% of pixels disagree",
    )

    for name in (
        "icon.png",
        "favicon.png",
        "android-icon-foreground.png",
        "android-icon-monochrome.png",
    ):
        size = (OUT / name).stat().st_size
        print(f"     {name:34s} {size / 1024:6.1f} KB")

    return problems


if __name__ == "__main__":
    mark = read_mark(SRC)
    height, width = mark.shape[:2]
    print(f"mark {width}x{height} from {SRC.relative_to(REPO)}")

    save(
        compose(resize_premultiplied(mark, round(ICON_MARK * ICON_SIZE)), ICON_SIZE, WHITE),
        OUT / "icon.png",
        False,
    )
    save(
        compose(
            resize_premultiplied(mark, round(FAVICON_MARK * FAVICON_SIZE)), FAVICON_SIZE, WHITE
        ),
        OUT / "favicon.png",
        False,
    )

    adaptive = resize_premultiplied(mark, adaptive_width(mark, ICON_SIZE))
    save(stamp(adaptive, ICON_SIZE), OUT / "android-icon-foreground.png", True)
    save(stamp(adaptive, ICON_SIZE, WHITE), OUT / "android-icon-monochrome.png", True)

    problems = verify()
    if problems:
        print(f"\n{len(problems)} icon problem(s)")
        sys.exit(1)
    print("\nicons written and checked")
