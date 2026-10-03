#!/usr/bin/env python3
"""
Generate App Store marketing screenshots for YouTube TLDW (FR + EN).

Renders a 3-frame "continuous banner" panorama sharing one brand background
(vertical red gradient + warm light-glow + soft seam circles, computed across
the full panorama width then sliced per frame) with a headline spanning the
three frames. Language-parameterised: text + source + output folder per lang.

Sources live in store-screenshots/<platform>[/<lang>]/, marketing output in
store-screenshots/<platform>/marketing[/<lang>]/ (FR is the default, no suffix).

Usage: /opt/homebrew/bin/python3 scripts/make-appstore-panorama.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "safari-ext-yt", "logo.png")
FONT = "/System/Library/Fonts/SFNS.ttf"

TOP = (228, 74, 64)   # #E44A40
BOT = (150, 16, 22)   # #961016
N = 3

# ---- per-language copy ------------------------------------------------------
TEXT = {
    "fr": {
        "head": ["Des heures\nde vidéo…", "…résumées…", "…en quelques\nsecondes"],
        "ios":  ["Colle un lien YouTube", "Un résumé clair et structuré", "Retrouve tout ton historique"],
        "mac":  ["Le résumé, intégré à l'app", "Tout ton historique au même endroit", "Directement dans Safari"],
    },
    "en": {
        "head": ["Hours\nof video…", "…summarized…", "…in seconds"],
        "ios":  ["Paste a YouTube link", "A clear, structured summary", "All your summaries, saved"],
        "mac":  ["Summaries built into the app", "All your history in one place", "Right inside Safari"],
    },
}

IOS_SHOTS = ["01-accueil.png", "02-resume.png", "03-historique.png"]
MAC_SHOTS = ["01-accueil-resume.png", "02-historique.png", "03-safari-sidebar.png"]


def load_font(size, variation=None):
    f = ImageFont.truetype(FONT, size)
    if variation:
        for v in ([variation] if isinstance(variation, str) else variation):
            try:
                f.set_variation_by_name(v); break
            except Exception:
                pass
    return f


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_background(W, H, FW):
    base = Image.new("RGB", (W, H))
    px = base.load()
    for y in range(H):
        c = lerp(TOP, BOT, y / (H - 1))
        for x in range(W):
            px[x, y] = c
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse(
        [W * 0.5 - W * 0.42, H * 0.20 - H * 0.42, W * 0.5 + W * 0.42, H * 0.20 + H * 0.42], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(round(FW * 0.318)))
    light = Image.new("RGB", (W, H), (255, 140, 120))
    base = Image.composite(light, base, glow.point(lambda v: int(v * 0.55)))
    deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    for ccx, ccy, cr, a in [
        (FW * 1.0, H * 0.86, FW * 0.47, 16),
        (FW * 2.0, H * 0.12, FW * 0.39, 14),
        (FW * 0.4, H * 0.55, FW * 0.27, 10),
    ]:
        dd.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=(255, 255, 255, a))
    return Image.alpha_composite(base.convert("RGBA"), deco.filter(ImageFilter.GaussianBlur(6)))


def draw_headline(base, FW, head, y, font, spacing):
    d = ImageDraw.Draw(base)
    for i, seg in enumerate(head):
        d.multiline_text((i * FW + FW / 2, y), seg, font=font, fill=(255, 255, 255),
                         anchor="mm", align="center", spacing=spacing)


def stamp_logo(frame, FW, H):
    try:
        logo = Image.open(LOGO).convert("RGBA")
        lh = round(H * 0.0335)
        logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
        lx, ly = round(FW * 0.06), round(H * 0.052)
        frame.alpha_composite(logo, (lx, ly))
        ImageDraw.Draw(frame).text((lx + logo.width + round(FW * 0.021), ly + lh / 2),
                                   "YouTube TLDW;", font=load_font(round(FW * 0.044), ["Bold", "Semibold"]),
                                   fill=(255, 255, 255), anchor="lm")
    except Exception as e:
        print("  logo skip:", e)


def save_set(frames, W, H, out_rel, names):
    OUT = os.path.join(ROOT, out_rel)
    os.makedirs(OUT, exist_ok=True)
    for name, fr in zip(names, frames):
        fr.convert("RGB").save(os.path.join(OUT, name), "PNG")
    stitch = Image.new("RGB", (W, H))
    for i, fr in enumerate(frames):
        stitch.paste(fr.convert("RGB"), (i * W // N, 0))
    stitch.resize((W // 3, H // 3), Image.LANCZOS).save(os.path.join(OUT, "panorama-preview.png"), "PNG")


# --------------------------------------------------------------------------- #
def generate_ios(lang, label, FW, FH, src_rel, out_rel):
    SRC = os.path.join(ROOT, src_rel)
    W = FW * N
    base = build_background(W, FH, FW)
    draw_headline(base, FW, TEXT[lang]["head"], round(FH * 0.146),
                  load_font(round(FW * 0.085), ["Heavy", "Bold"]), round(FW * 0.0136))

    SCREEN_H, SCREEN_W = round(FH * 0.60), round(FW * 0.60)
    BEZEL, R_SCR = round(FW * 0.0167), round(FW * 0.044)
    R_DEV = R_SCR + BEZEL
    DEV_W, DEV_H = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    DEV_TOP = round(FH * 0.268)
    cap_font = load_font(round(FW * 0.0394), ["Semibold", "Bold"])
    caps = TEXT[lang]["ios"]

    frames = []
    for i, shot in enumerate(IOS_SHOTS):
        sl = base.crop((i * FW, 0, (i + 1) * FW, FH)).convert("RGBA")
        dev_x = (FW - DEV_W) // 2
        shadow = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [dev_x, DEV_TOP + round(FH * 0.012), dev_x + DEV_W, DEV_TOP + DEV_H + round(FH * 0.012)],
            radius=R_DEV, fill=(40, 0, 0, 150))
        sl = Image.alpha_composite(sl, shadow.filter(ImageFilter.GaussianBlur(46)))
        body = Image.new("RGBA", (DEV_W, DEV_H), (0, 0, 0, 0))
        ImageDraw.Draw(body).rounded_rectangle([0, 0, DEV_W, DEV_H], radius=R_DEV, fill=(12, 12, 14, 255))
        pic = Image.open(os.path.join(SRC, shot)).convert("RGBA").resize((SCREEN_W, SCREEN_H), Image.LANCZOS)
        mask = Image.new("L", (SCREEN_W, SCREEN_H), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, SCREEN_W, SCREEN_H], radius=R_SCR, fill=255)
        body.paste(pic, (BEZEL, BEZEL), mask)
        sl.alpha_composite(body, (dev_x, DEV_TOP))
        ImageDraw.Draw(sl).text((FW / 2, DEV_TOP + DEV_H + round(FH * 0.033)), caps[i],
                                font=cap_font, fill=(255, 255, 255, 240), anchor="mm")
        frames.append(sl)
    stamp_logo(frames[0], FW, FH)
    save_set(frames, W, FH, out_rel, IOS_SHOTS)
    print(f"[ios {lang} {label}] {FW}x{FH} -> {out_rel}/")


def generate_ipad(lang, FW, FH, src_rel, out_rel):
    SRC = os.path.join(ROOT, src_rel)
    W = FW * N
    base = build_background(W, FH, FW)
    draw_headline(base, FW, TEXT[lang]["head"], round(FH * 0.11),
                  load_font(round(FW * 0.060), ["Heavy", "Bold"]), round(FW * 0.010))

    SCREEN_H, SCREEN_W = round(FH * 0.62), round(FW * 0.62)
    BEZEL, R_SCR = round(FW * 0.011), round(FW * 0.020)
    R_DEV = R_SCR + BEZEL
    DEV_W, DEV_H = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    DEV_TOP = round(FH * 0.235)
    cap_font = load_font(round(FW * 0.028), ["Semibold", "Bold"])
    caps = TEXT[lang]["ios"]

    frames = []
    for i, shot in enumerate(IOS_SHOTS):
        sl = base.crop((i * FW, 0, (i + 1) * FW, FH)).convert("RGBA")
        dev_x = (FW - DEV_W) // 2
        shadow = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [dev_x, DEV_TOP + round(FH * 0.010), dev_x + DEV_W, DEV_TOP + DEV_H + round(FH * 0.010)],
            radius=R_DEV, fill=(40, 0, 0, 150))
        sl = Image.alpha_composite(sl, shadow.filter(ImageFilter.GaussianBlur(46)))
        body = Image.new("RGBA", (DEV_W, DEV_H), (0, 0, 0, 0))
        ImageDraw.Draw(body).rounded_rectangle([0, 0, DEV_W, DEV_H], radius=R_DEV, fill=(12, 12, 14, 255))
        pic = Image.open(os.path.join(SRC, shot)).convert("RGBA").resize((SCREEN_W, SCREEN_H), Image.LANCZOS)
        mask = Image.new("L", (SCREEN_W, SCREEN_H), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, SCREEN_W, SCREEN_H], radius=R_SCR, fill=255)
        body.paste(pic, (BEZEL, BEZEL), mask)
        sl.alpha_composite(body, (dev_x, DEV_TOP))
        ImageDraw.Draw(sl).text((FW / 2, DEV_TOP + DEV_H + round(FH * 0.028)), caps[i],
                                font=cap_font, fill=(255, 255, 255, 240), anchor="mm")
        frames.append(sl)
    save_set(frames, W, FH, out_rel, IOS_SHOTS)
    print(f"[ipad {lang}] {FW}x{FH} -> {out_rel}/")


def generate_mac(lang, FW, FH, src_rel, out_rel):
    SRC = os.path.join(ROOT, src_rel)
    W = FW * N
    base = build_background(W, FH, FW)
    draw_headline(base, FW, TEXT[lang]["head"], round(FH * 0.105),
                  load_font(round(FW * 0.050), ["Heavy", "Bold"]), round(FW * 0.008))

    WIN_H, WIN_MAXW = round(FH * 0.66), round(FW * 0.86)
    WIN_TOP = round(FH * 0.195)
    cap_font = load_font(round(FW * 0.026), ["Semibold", "Bold"])
    caps = TEXT[lang]["mac"]

    frames = []
    for i, shot in enumerate(MAC_SHOTS):
        sl = base.crop((i * FW, 0, (i + 1) * FW, FH)).convert("RGBA")
        win = Image.open(os.path.join(SRC, shot)).convert("RGBA")
        th = WIN_H
        tw = round(win.width * th / win.height)
        if tw > WIN_MAXW:
            tw = WIN_MAXW; th = round(win.height * tw / win.width)
        win = win.resize((tw, th), Image.LANCZOS)
        wx, wy = (FW - tw) // 2, WIN_TOP
        alpha = win.split()[3]
        shadow = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        shadow.paste(Image.new("RGBA", (tw, th), (30, 0, 0, 150)), (wx, wy + round(FH * 0.02)), alpha)
        sl = Image.alpha_composite(sl, shadow.filter(ImageFilter.GaussianBlur(55)))
        sl.alpha_composite(win, (wx, wy))
        ImageDraw.Draw(sl).text((FW / 2, round(FH * 0.905)), caps[i],
                                font=cap_font, fill=(255, 255, 255, 240), anchor="mm")
        frames.append(sl)
    save_set(frames, W, FH, out_rel, MAC_SHOTS)
    print(f"[mac {lang}] {FW}x{FH} -> {out_rel}/")


if __name__ == "__main__":
    # French (complete)
    generate_ios("fr", "6.9", 1320, 2868, "store-screenshots/ios",     "store-screenshots/ios/marketing")
    generate_ios("fr", "6.5", 1284, 2778, "store-screenshots/ios/6.5", "store-screenshots/ios/marketing/6.5")
    generate_mac("fr", 2880, 1800, "store-screenshots/mac", "store-screenshots/mac/marketing")
    generate_ipad("fr", 2064, 2752, "store-screenshots/ipad", "store-screenshots/ipad/marketing")
    # English (complete)
    generate_ios("en", "6.9", 1320, 2868, "store-screenshots/ios/en", "store-screenshots/ios/marketing/en")
    generate_ios("en", "6.5", 1284, 2778, "store-screenshots/ios/en", "store-screenshots/ios/marketing/6.5/en")
    generate_mac("en", 2880, 1800, "store-screenshots/mac/en", "store-screenshots/mac/marketing/en")
    generate_ipad("en", 2064, 2752, "store-screenshots/ipad/en", "store-screenshots/ipad/marketing/en")
