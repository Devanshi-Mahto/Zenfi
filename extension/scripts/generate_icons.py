"""Generate ZenFi extension PNG icons."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install Pillow")
    raise

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

SIZES = (16, 48, 128)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = max(1, size // 8)
    d.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 4,
        fill=(108, 99, 255, 255),
    )
    # Simple Z mark
    fw = max(1, size // 8)
    mid = size // 2
    d.line([(margin * 2, margin * 2), (size - margin * 2, margin * 2)], fill=(255, 255, 255, 255), width=fw)
    d.line([(size - margin * 2, margin * 2), (margin * 2, size - margin * 2)], fill=(255, 255, 255, 255), width=fw)
    d.line([(margin * 2, size - margin * 2), (size - margin * 2, size - margin * 2)], fill=(0, 212, 170, 255), width=fw)
    return img


for s in SIZES:
    draw_icon(s).save(OUT / f"icon{s}.png")
    print(f"Wrote icons/icon{s}.png")
