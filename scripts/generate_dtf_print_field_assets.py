from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT_ROOT = Path('apps/admin/src/assets/DTF_Print_Field_Assets')
TMP = Path('tmp/real_templates')
CANVAS = (1400, 1400)

SCALE = {
    'small': 0.72,
    'medium': 1.0,
    'large': 1.28,
}

# Internet-sourced template images
# rect = normalized (cx, cy, w, h) on source image
BASES = {
    ('TShirt', 'front'): {
        'path': TMP / 'src_7.png',
        'rect': (0.50, 0.43, 0.33, 0.29),
        'remove_black_bg': True,
    },
    ('TShirt', 'back'): {
        'path': TMP / 'src_3.png',
        'rect': (0.50, 0.46, 0.40, 0.36),
    },
    ('TShirt', 'left_chest'): {
        'path': TMP / 'src_4.png',
        'rect': (0.68, 0.40, 0.16, 0.13),
    },
    ('TShirt', 'sleeve'): {
        'path': TMP / 'tshirt_sleeve.png',
        'rect': (0.90, 0.22, 0.10, 0.14),
    },
    ('Hoodie', 'front'): {
        'path': TMP / 'src_2.png',
        'rect': (0.50, 0.43, 0.32, 0.30),
    },
    ('Hoodie', 'back'): {
        'path': TMP / 'src_1.png',
        'rect': (0.50, 0.45, 0.34, 0.31),
    },
    ('Hoodie', 'left_chest'): {
        'path': TMP / 'src_2.png',
        'rect': (0.39, 0.36, 0.16, 0.13),
    },
    ('Hoodie', 'sleeve'): {
        'path': TMP / 'src_2.png',
        'rect': (0.82, 0.53, 0.12, 0.16),
    },
    ('Sweatshirt', 'front'): {
        'path': TMP / 'src_6.png',
        'rect': (0.50, 0.44, 0.34, 0.31),
    },
    ('Sweatshirt', 'back'): {
        'path': TMP / 'src_1.png',
        'rect': (0.50, 0.45, 0.34, 0.31),
    },
    ('Sweatshirt', 'left_chest'): {
        'path': TMP / 'src_6.png',
        'rect': (0.39, 0.35, 0.16, 0.13),
    },
    ('Sweatshirt', 'sleeve'): {
        'path': TMP / 'src_6.png',
        'rect': (0.81, 0.53, 0.12, 0.16),
    },
}


def remove_black_bg(img: Image.Image) -> Image.Image:
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < 18 and g < 18 and b < 18:
                px[x, y] = (r, g, b, 0)
    return rgba


def make_canvas() -> Image.Image:
    im = Image.new('RGBA', CANVAS, (243, 245, 249, 255))
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle((82, 72, 1318, 1320), radius=44, fill=(252, 253, 255, 255), outline=(220, 226, 234, 255), width=3)

    sh = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh, 'RGBA')
    sd.ellipse((360, 1080, 1040, 1230), fill=(40, 45, 55, 44))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    im.alpha_composite(sh)
    return im


def fit_template(template: Image.Image):
    tw, th = template.size
    max_w, max_h = 1120, 980
    scale = min(max_w / tw, max_h / th)
    nw, nh = int(tw * scale), int(th * scale)
    resized = template.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (CANVAS[0] - nw) // 2
    y = 130 + (max_h - nh) // 2
    return resized, (x, y, x + nw, y + nh)


def scaled_rect(frame, norm_rect, size_key):
    x1, y1, x2, y2 = frame
    fw, fh = x2 - x1, y2 - y1
    cxn, cyn, wn, hn = norm_rect

    cx = x1 + fw * cxn
    cy = y1 + fh * cyn

    s = SCALE[size_key]
    w = fw * wn * s
    h = fh * hn * s
    return (int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))


def draw_zone(img: Image.Image, rect):
    x1, y1, x2, y2 = rect

    glow = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, 'RGBA')
    gd.rounded_rectangle((x1 - 6, y1 - 6, x2 + 6, y2 + 6), radius=14, fill=(42, 174, 96, 52))
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(glow)

    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle(rect, radius=12, fill=(87, 206, 123, 88), outline=(29, 129, 70, 250), width=4)

    inset = 12
    ix1, iy1, ix2, iy2 = x1 + inset, y1 + inset, x2 - inset, y2 - inset
    step = 18
    for x in range(ix1, ix2, step * 2):
        d.line((x, iy1, min(ix2, x + step), iy1), fill=(24, 102, 58, 210), width=2)
        d.line((x, iy2, min(ix2, x + step), iy2), fill=(24, 102, 58, 210), width=2)
    for y in range(iy1, iy2, step * 2):
        d.line((ix1, y, ix1, min(iy2, y + step)), fill=(24, 102, 58, 210), width=2)
        d.line((ix2, y, ix2, min(iy2, y + step)), fill=(24, 102, 58, 210), width=2)


def draw_caption(img: Image.Image, garment, placement, size_key):
    d = ImageDraw.Draw(img, 'RGBA')
    d.rounded_rectangle((140, 1210, 1260, 1295), radius=16, fill=(255, 255, 255, 240), outline=(208, 216, 226, 255), width=2)
    text = f"{garment} | {placement.replace('_', ' ').title()} | {size_key.title()}"
    d.text((180, 1238), text, fill=(57, 65, 78, 255))


def render(garment, placement, size_key):
    spec = BASES[(garment, placement)]
    src = Image.open(spec['path'])
    if spec.get('remove_black_bg'):
        src = remove_black_bg(src)
    else:
        src = src.convert('RGBA')

    canvas = make_canvas()
    fitted, frame = fit_template(src)
    canvas.alpha_composite(fitted, (frame[0], frame[1]))

    rect = scaled_rect(frame, spec['rect'], size_key)
    draw_zone(canvas, rect)
    draw_caption(canvas, garment, placement, size_key)

    out_dir = OUT_ROOT / garment
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{placement}_{size_key}.png"
    canvas.save(out, format='PNG')


def main():
    for garment in ('Hoodie', 'TShirt', 'Sweatshirt'):
        for placement in ('front', 'back', 'left_chest', 'sleeve'):
            for size_key in ('small', 'medium', 'large'):
                render(garment, placement, size_key)


if __name__ == '__main__':
    main()
