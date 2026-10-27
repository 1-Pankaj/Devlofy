"""Devlofy social preview card - the 1200x630 image a link unfurls into.

    python tools/brand/make-og.py

Reads the night mark (`site/assets/brand/mark-night.png`) and Mona Sans, and
writes `site/assets/og.png`. Mona Sans is not vendored for tooling, so the
script fetches the variable TTF from github/mona-sans once and caches it under
the system temp directory; the page itself uses the woff2 already in `site/`.

Conventions
-----------
* Drawn at 2x and downsampled once with Lanczos: crisp text, and the same
  hairline weights the page uses at 1x.
* The palette is the landing page's night ramp - near-black `#08090c`, white
  ink, muted `#a7b0ba`, violet `#6333fb` / `#a48bff` - so a shared card looks
  like the site.
* The dot field uses the hero's maths: a radial mask that fades before it
  reaches the copy, never a tile behind it.
* The card carries only figures the repository can prove: the version tag, the
  platforms, and the check count.

Idempotent: re-running rewrites the same file from the same inputs.
"""

from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
MARK = REPO / "site" / "assets" / "brand" / "mark-night.png"
OUT = REPO / "site" / "assets" / "og.png"
CACHE = Path.home() / "AppData" / "Local" / "Temp" / "opencode" / "fonts" / "MonaSansVF.ttf"
FONT_URL = "https://raw.githubusercontent.com/github/mona-sans/main/fonts/variable/MonaSansVF%5Bopsz%2Cwght%5D.ttf"

W, H, S = 1200, 630, 2

NIGHT = (8, 9, 12)
INK = (240, 246, 252)
MUTED = (167, 176, 186)
SUBTLE = (139, 148, 158)
BORDER = (48, 54, 61)
ACCENT = (164, 139, 255)
GLOW = (99, 51, 251)
LAVENDER = (201, 184, 255)


def font(size, weight=400, optical=32):
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_bytes(urlopen(FONT_URL).read())
    face = ImageFont.truetype(str(CACHE), size * S)
    face.set_variation_by_axes([weight, optical])
    return face


def background():
    """Near-black, a violet wash from the top, and a dot field that fades out."""
    yy, xx = np.mgrid[0 : H * S, 0 : W * S].astype(np.float64)
    canvas = np.ones((H * S, W * S, 3), dtype=np.float64) * np.array(NIGHT, dtype=np.float64)

    # Violent violet at the top centre, falling off before the body copy.
    cx, cy = W * S * 0.5, -H * S * 0.18
    radius = np.hypot((xx - cx) / (W * S * 0.64), (yy - cy) / (H * S * 0.92))
    wash = np.clip(1.0 - radius, 0.0, 1.0) ** 1.7 * 0.72
    for channel in range(3):
        canvas[..., channel] = canvas[..., channel] * (1 - wash) + GLOW[channel] * wash

    # A quieter second pool under the evidence column, so the right is not flat.
    cx2, cy2 = W * S * 0.92, H * S * 0.72
    radius2 = np.hypot((xx - cx2) / (W * S * 0.42), (yy - cy2) / (H * S * 0.75))
    wash2 = np.clip(1.0 - radius2, 0.0, 1.0) ** 2.0 * 0.2
    for channel in range(3):
        canvas[..., channel] = canvas[..., channel] * (1 - wash2) + GLOW[channel] * wash2

    # White dot field, masked by the primary wash.
    step = 22 * S
    dots = np.zeros((H * S, W * S), dtype=bool)
    dots[step // 2 :: step, step // 2 :: step] = True
    weight = np.clip(0.55 - radius * 0.8, 0.0, 1.0) * dots
    alpha = weight[..., None] * 0.16
    canvas = canvas * (1 - alpha) + 255.0 * alpha
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB")


def night_mark(width):
    """The transparent night mark, scaled once with Lanczos."""
    image = Image.open(MARK).convert("RGBA")
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.LANCZOS)


def tracked_width(text, face, tracking):
    return sum(face.getlength(char) for char in text) + tracking * S * (len(text) - 1)


def tracked(draw, xy, text, face, fill, tracking=0.0):
    """Mono labels only: per-character drawing, where lost kerning does not show."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=face, fill=fill)
        x += face.getlength(char) + tracking * S


def build():
    card = background()
    draw = ImageDraw.Draw(card)

    # Header: mark, wordmark, version, platform line.
    mark = night_mark(56 * S)
    card.paste(mark, (88 * S, 72 * S), mark)
    draw.text((160 * S, 100 * S), "Devlofy", font=font(27, 700, 24), fill=INK, anchor="lm")
    draw.text((298 * S, 101 * S), "v0.8.0", font=font(15, 500, 24), fill=SUBTLE, anchor="lm")

    mono = font(12.5, 500)
    release = "ANDROID + WEB  ·  MIT  ·  OFFLINE-FIRST"
    tracked(
        draw,
        (1112 * S - tracked_width(release, mono, 0.1), 100 * S),
        release,
        mono,
        SUBTLE,
        0.1,
    )

    # Headline: white then lavender, the page's gradient reduced to two stops.
    headline = font(86, 800, 48)
    draw.text((88 * S, 186 * S), "The command center", font=headline, fill=INK)
    draw.text((88 * S, 276 * S), "for solo developers.", font=headline, fill=LAVENDER)

    # Supporting copy.
    body = font(23, 400, 24)
    draw.text(
        (89 * S, 398 * S),
        "Tasks, focus time, client work, invoices and notes,",
        font=body,
        fill=MUTED,
    )
    draw.text(
        (89 * S, 432 * S),
        "in one app that keeps everything on your device.",
        font=body,
        fill=MUTED,
    )

    # Evidence column: three numbers the repository can prove. Left edges line
    # up so the ragged label widths never make the numbers look mis-set.
    number = font(38, 600, 40)
    label = font(10.5, 500)
    for index, (value, caption) in enumerate(
        [
            ("482", "KNOWN-ANSWER CHECKS"),
            ("11", "OFFLINE BENCH TOOLS"),
            ("0", "BACKEND SERVICES"),
        ]
    ):
        top = 286 + index * 72
        draw.text((952 * S, top * S), value, font=number, fill=INK)
        tracked(
            draw,
            (952 * S, (top + 48) * S),
            caption,
            label,
            SUBTLE,
            0.14,
        )

    # Footer rule and platform line.
    draw.line((88 * S, 512 * S, 1112 * S, 512 * S), fill=BORDER, width=S)
    foot = font(12.5, 500)
    tracked(draw, (88 * S, 538 * S), "EXPO SDK 58   ·   SQLITE ON DEVICE   ·   MIT", foot, SUBTLE, 0.1)
    draw.text(
        (1112 * S, 536 * S),
        "github.com/1-Pankaj/Devlofy",
        font=font(13, 600, 24),
        fill=ACCENT,
        anchor="ra",
    )

    card = card.resize((W, H), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.save(OUT, optimize=True)
    print(f"{OUT.relative_to(REPO)}  {W}x{H}  {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    build()
