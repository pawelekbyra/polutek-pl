"""Generates the POLUTEK lockup (play badge + wordmark) as outlined SVG paths.

Usage (from the repo root):
    python scripts/brand/generate-wordmark.py --font path/to/Nunito[wght].ttf [--gaps gaps.json]
"POLUTEK" and ".COM" are both ink (".COM" is small, on the baseline); the badge is the brand blue.
Writes app/components/brand/polutek-wordmark-paths.ts and public/brand/polutek-wordmark*.svg.

The letters are outlines of Nunito (variable font, SIL Open Font License 1.1, copyright 2014 The
Nunito Project Authors, https://github.com/googlefonts/nunito), modified: each letter is taken at its own
weight and narrowed horizontally so that stem weight (~0.22 of cap height), horizontal stroke weight
(~0.19) and letter widths match the owner's reference rendering, then re-spaced optically. See
public/brand/NOTICE-Nunito-OFL.txt for the licence. The badge is original geometry.
Cap height = 100 units, baseline y = 100.
"""
import json
import math
import os
import sys

SV = 22.4            # vertical stem weight (reference: 0.232 of cap; ours is ~3% lighter)
SH = 19.2            # horizontal stroke weight (reference: 0.199 of cap)
HV, HH = SV / 2, SH / 2
OV = 1.2             # optical overshoot of round letters
CAP = 100.0


def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def area_poly(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def capsule(p1, p2, r):
    (x1, y1), (x2, y2) = p1, p2
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy)
    nx, ny = -dy / n * r, dx / n * r
    if area_poly([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]) < 0:
        nx, ny = -nx, -ny
    return "M%s %sL%s %sA%s %s 0 0 1 %s %sL%s %sA%s %s 0 0 1 %s %sZ" % (
        f(x1 + nx), f(y1 + ny), f(x2 + nx), f(y2 + ny), f(r), f(r), f(x2 - nx), f(y2 - ny),
        f(x1 - nx), f(y1 - ny), f(r), f(r), f(x1 + nx), f(y1 + ny))


def circle(c, r):
    return "M%s %sA%s %s 0 1 1 %s %sA%s %s 0 1 1 %s %sZ" % (
        f(c[0] - r), f(c[1]), f(r), f(r), f(c[0] + r), f(c[1]), f(r), f(r), f(c[0] - r), f(c[1]))


def ep(c, rx, ry, t):
    a = math.radians(t)
    return (c[0] + rx * math.cos(a), c[1] + ry * math.sin(a))


def ring_full(c, rxo, ryo, rxi, ryi):
    """Closed elliptical ring: outer clockwise, inner counter-clockwise (a hole)."""
    return ("M%s %sA%s %s 0 1 1 %s %sA%s %s 0 1 1 %s %sZ" % (f(c[0] + rxo), f(c[1]), f(rxo), f(ryo), f(c[0] - rxo), f(c[1]), f(rxo), f(ryo), f(c[0] + rxo), f(c[1]))
            + "M%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZ" % (f(c[0] + rxi), f(c[1]), f(rxi), f(ryi), f(c[0] - rxi), f(c[1]), f(rxi), f(ryi), f(c[0] + rxi), f(c[1])))


def ring_part(c, rxo, ryo, rxi, ryi, t0, t1):
    """Part of an elliptical ring between parametric angles t0 < t1 (degrees, clockwise on screen)."""
    big = 1 if (t1 - t0) > 180 else 0
    o0, o1 = ep(c, rxo, ryo, t0), ep(c, rxo, ryo, t1)
    i0, i1 = ep(c, rxi, ryi, t0), ep(c, rxi, ryi, t1)
    return "M%s %sA%s %s 0 %d 1 %s %sL%s %sA%s %s 0 %d 0 %s %sZ" % (
        f(o0[0]), f(o0[1]), f(rxo), f(ryo), big, f(o1[0]), f(o1[1]), f(i1[0]), f(i1[1]),
        f(rxi), f(ryi), big, f(i0[0]), f(i0[1]))


def round_cap(c, rxo, ryo, rxi, ryi, t):
    """Round end for a ring cut at parametric angle t: a disc whose diameter is the local stroke."""
    o, i = ep(c, rxo, ryo, t), ep(c, rxi, ryi, t)
    return circle(((o[0] + i[0]) / 2, (o[1] + i[1]) / 2), math.hypot(o[0] - i[0], o[1] - i[1]) / 2)


# ---------------------------------------------------------------- glyphs (Nunito outlines)
# One table for the width and weight of every letter (everything that decides the rhythm of the word is here).
#   width  ink width / cap height. The simple letters (P, L, E, T, K, U) share about the same width (0.70-0.76), the round
#          O is about 10% wider than U (optical overshoot of a round form).
#   wght   Nunito weight instance the outline is taken from (stem and bar weights were matched at 900 / 875).
#   stem   (E, L) wanted stem thickness / cap height. These two letters are naturally narrow, so they are not stretched as a
#          whole: only the stem is condensed to the common stem weight and the arms are lengthened (xk = x of the stem's inner
#          edge in font units), which keeps the bar thickness and the rounded ends as drawn.
LETTERS = {
    "P": {"width": 0.73, "wght": 900},
    "O": {"width": 0.84, "wght": 900},
    "L": {"width": 0.70, "wght": 900, "stem": 0.222, "xk": 248},
    "U": {"width": 0.76, "wght": 900},
    "T": {"width": 0.76, "wght": 900},
    "E": {"width": 0.70, "wght": 900, "stem": 0.222, "xk": 240},
    "K": {"width": 0.76, "wght": 875},
}
WGHT = {k: v["wght"] for k, v in LETTERS.items()}
WORD = ["P", "O", "L", "U", "T", "E", "K"]
# Optical gaps (edge to edge, cap/100 units) after each pair, tuned so the area between neighbouring glyph profiles is even.
GAPS = {"P-O": 11.58, "O-L": 16.5, "L-U": 3.5, "U-T": 6.0, "T-E": 6.0, "E-K": 15.08}


def load_font(path):
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    cache = {}

    def get(w):
        if w not in cache:
            cache[w] = instancer.instantiateVariableFont(TTFont(path), {"wght": w}, inplace=False)
        return cache[w]
    return get


def glyph_outline(font, ch, x):
    """Returns (ink width, path) of glyph ch placed with its left ink edge at x (cap = 100 units)."""
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.recordingPen import RecordingPen
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    spec = LETTERS[ch]
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    lb = BoundsPen(gs); gs[cmap[ord("L")]].draw(lb)
    cap = lb.bounds[3] - lb.bounds[1]
    unit = 100.0 / cap
    bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    want = spec["width"] * cap                                    # wanted ink width in font units
    if "xk" in spec:                                              # stem condensed, arms lengthened
        xk = spec["xk"]
        stem_w = xk - x0
        s1 = spec["stem"] * cap / stem_w
        s2 = (want - stem_w * s1) / (x1 - xk)
        mapx = lambda X: (X - x0) * s1 if X <= xk else stem_w * s1 + (X - xk) * s2
    else:                                                         # plain horizontal scale
        k = want / (x1 - x0)
        mapx = lambda X: (X - x0) * k
    rec = RecordingPen(); gs[cmap[ord(ch)]].draw(rec)
    mapped = RecordingPen()
    mapped.value = [(op, tuple((mapx(px), py) for px, py in args)) for op, args in rec.value]
    pen = SVGPathPen(gs, ntos=f)
    mapped.replay(TransformPen(pen, (unit, 0, 0, -unit, x, 100.0)))
    return want * unit, pen.getCommands()


# ---------------------------------------------------------------- play badge
BADGE_H, BADGE_W = 120.0, 168.0          # 1.2 x cap, 1.4 : 1
BADGE_GAP = 22.69                         # to the P: 0.227 x cap = 4 px at the phone render (21 px tall)
CY = 50.0                                 # vertically centred on the cap-height middle


def badge_segments(inset=0.0):
    """Rounded-rectangle badge (smooth squircle-ish corners) inset by `inset` units, clockwise.
    Returns (start point, [("L", end) | ("C", c1, c2, end)])."""
    x0, y0, w, h = inset, CY - BADGE_H / 2 + inset, BADGE_W - 2 * inset, BADGE_H - 2 * inset
    r = 0.30 * BADGE_H - inset
    c = 0.36 * r
    x1, y1 = x0 + w, y0 + h
    segs = [("L", (x1 - r, y0)), ("C", (x1 - c, y0), (x1, y0 + c), (x1, y0 + r)),
            ("L", (x1, y1 - r)), ("C", (x1, y1 - c), (x1 - c, y1), (x1 - r, y1)),
            ("L", (x0 + r, y1)), ("C", (x0 + c, y1), (x0, y1 - c), (x0, y1 - r)),
            ("L", (x0, y0 + r)), ("C", (x0, y0 + c), (x0 + c, y0), (x0 + r, y0))]
    return (x0 + r, y0), segs


def badge_path(inset=0.0, cw=True):
    start, segs = badge_segments(inset)
    if cw:
        out = ["M%s %s" % (f(start[0]), f(start[1]))]
        for sg in segs:
            if sg[0] == "L":
                out.append("L%s %s" % (f(sg[1][0]), f(sg[1][1])))
            else:
                out.append("C%s %s %s %s %s %s" % tuple(f(v) for pt in sg[1:] for v in pt))
        return "".join(out) + "Z"
    # counter-clockwise: walk the segments backwards
    ends = [start] + [sg[-1] for sg in segs]
    out = ["M%s %s" % (f(start[0]), f(start[1]))]
    for k in range(len(segs) - 1, -1, -1):
        sg, a = segs[k], ends[k]
        if sg[0] == "L":
            out.append("L%s %s" % (f(a[0]), f(a[1])))
        else:
            out.append("C%s %s %s %s %s %s" % tuple(f(v) for pt in (sg[2], sg[1], a) for v in pt))
    return "".join(out) + "Z"


def rounded_polygon(pts, rr, cw=True):
    n = len(pts)
    out = []
    for i in range(n):
        p, v, q = pts[i - 1], pts[i], pts[(i + 1) % n]
        a = (p[0] - v[0], p[1] - v[1]); b = (q[0] - v[0], q[1] - v[1])
        la, lb = math.hypot(*a), math.hypot(*b)
        ua, ub = (a[0] / la, a[1] / la), (b[0] / lb, b[1] / lb)
        ang = math.acos(max(-1, min(1, ua[0] * ub[0] + ua[1] * ub[1])))
        d = rr / math.tan(ang / 2)
        s = (v[0] + ua[0] * d, v[1] + ua[1] * d); e = (v[0] + ub[0] * d, v[1] + ub[1] * d)
        out.append("%s%s %s" % ("M" if i == 0 else "L", f(s[0]), f(s[1])))
        out.append("A%s %s 0 0 %d %s %s" % (f(rr), f(rr), 1 if cw else 0, f(e[0]), f(e[1])))
    return "".join(out) + "Z"


def triangle_path(cw=True):
    ht = 0.47 * BADGE_H
    wt = 0.85 * ht
    left = BADGE_W / 2 - wt / 2 + 0.10 * wt
    pts = [(left, CY - ht / 2), (left + wt, CY), (left, CY + ht / 2)]    # clockwise on screen
    if not cw:
        pts = pts[::-1]
    return rounded_polygon(pts, 0.12 * ht, cw)


def build(gaps, fontget):
    x = 0.0
    glyphs, ink = [], []
    for i, ch in enumerate(WORD):
        w, d = glyph_outline(fontget(WGHT[ch]), ch, x)
        glyphs.append({"ch": ch, "x": round(x, 2), "w": round(w, 2)})
        ink.append(d)
        x += w + (gaps["%s-%s" % (ch, WORD[i + 1])] if i < len(WORD) - 1 else 0)
    return x, glyphs, "".join(ink)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", required=True, help="path to Nunito[wght].ttf (SIL OFL 1.1)")
    ap.add_argument("--gaps", help="JSON with per-pair gap overrides")
    args = ap.parse_args()
    gaps = dict(GAPS)
    if args.gaps:
        gaps.update(json.load(open(args.gaps)))
    total, glyphs, ink_d = build(gaps, load_font(args.font))
    badge_d = badge_path(0.0)                       # the whole badge footprint, one flat shape
    tri_hole = triangle_path(False)                 # mono variants: the triangle is a hole in the badge
    tri_d = triangle_path(True)
    text_x = BADGE_W + BADGE_GAP
    W_FULL = round(text_x + total, 2)
    W_TEXT = round(total, 2)
    vb_full = "0 %s %s %s" % (f(CY - BADGE_H / 2), f(W_FULL), f(BADGE_H))
    vb_text = "0 %s %s %s" % (f(-OV), f(W_TEXT), f(CAP + 2 * OV))
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    head = ('<?xml version="1.0" encoding="UTF-8"?>\n<!-- POLUTEK.COM. Letters: outlines of Nunito (c) 2014 The Nunito Project Authors, '
            'SIL Open Font License 1.1, modified (per-letter weight, narrowed, re-spaced); see NOTICE-Nunito-OFL.txt. '
            'Generated by scripts/brand/generate-wordmark.py. -->\n')

    def svg(vb, body, label="POLUTEK.COM"):
        return head + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" aria-label="%s"><title>%s</title>%s</svg>\n' % (vb, label, label, body)
    tg = 'transform="translate(%s 0)"' % f(text_x)
    files = {
        "polutek-wordmark.svg": svg(vb_full, '<path fill="#2563eb" d="%s"/><path fill="#fff" d="%s"/><g %s><path fill="#092598" d="%s"/></g>' % (badge_d, tri_d, tg, ink_d)),
        "polutek-wordmark-nobadge.svg": svg(vb_text, '<path fill="#092598" d="%s"/>' % ink_d),
        "polutek-wordmark-mono.svg": svg(vb_full, '<path fill="currentColor" d="%s%s"/><g %s><path fill="currentColor" d="%s"/></g>' % (badge_d, tri_hole, tg, ink_d)),
        "polutek-wordmark-mono-nobadge.svg": svg(vb_text, '<path fill="currentColor" d="%s"/>' % ink_d),
    }
    os.makedirs(os.path.join(root, "public", "brand"), exist_ok=True)
    for name, text in files.items():
        with open(os.path.join(root, "public", "brand", name), "w", newline="\n", encoding="utf-8") as fh:
            fh.write(text)
    ts = ('// Generated by scripts/brand/generate-wordmark.py: do not edit by hand.\n'
          'export const WORDMARK_VIEWBOX_FULL = "%s";\nexport const WORDMARK_VIEWBOX_TEXT = "%s";\n'
          'export const WORDMARK_TEXT_X = %s;\n'
          'export const BADGE_PATH =\n  "%s";\nexport const PLAY_PATH =\n  "%s";\n'
          'export const INK_PATH =\n  "%s";\n') % (vb_full, vb_text, f(text_x), badge_d, tri_d, ink_d)
    with open(os.path.join(root, "app", "components", "brand", "polutek-wordmark-paths.ts"), "w", newline="\n", encoding="utf-8") as fh:
        fh.write(ts)
    json.dump({"total": total, "glyphs": glyphs, "textX": text_x, "full": W_FULL}, open(os.path.join(os.environ.get("WM_META_DIR", root), "wordmark-meta.json") if os.environ.get("WM_META_DIR") else os.devnull, "w"))
    print("text width", W_TEXT, "lockup width", W_FULL, "aspect(lockup)", round(W_FULL / BADGE_H, 3))


if __name__ == "__main__":
    main()
