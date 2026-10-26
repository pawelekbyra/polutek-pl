"""Usage: python generate-wordmark.py '{}' out.json  (optional first arg: JSON of per-pair gap overrides; env WT = stroke weight).
The JSON paths (ink / blue) are pasted into app/components/brand/PolutekWordmark.tsx and public/brand/*.svg.
Generates the POLUTEK.COM wordmark as outlined SVG paths (no font, original geometry).
Every glyph is a union of round-capped strokes (capsules, circular arcs, dots) of one weight W,
emitted as closed outlines that all wind the same way (nonzero fill => clean union, no seams)."""
import math, json, sys

W = float(__import__("os").environ.get("WT","24"))
H = W / 2
def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def area_poly(pts):
    a = 0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2

def capsule(p1, p2, r=H):
    (x1, y1), (x2, y2) = p1, p2
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * r, dx / L * r
    # polygon sample to test orientation (y down: positive area = clockwise visually)
    pts = [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]
    if area_poly(pts) < 0:
        nx, ny = -nx, -ny
    d = "M%s %sL%s %sA%s %s 0 0 1 %s %sL%s %sA%s %s 0 0 1 %s %sZ" % (
        f(x1 + nx), f(y1 + ny), f(x2 + nx), f(y2 + ny), f(r), f(r), f(x2 - nx), f(y2 - ny),
        f(x1 - nx), f(y1 - ny), f(r), f(r), f(x1 + nx), f(y1 + ny))
    return d

def pt(c, R, a):
    return (c[0] + R * math.cos(math.radians(a)), c[1] + R * math.sin(math.radians(a)))

def arc(c, R, a0, a1, r=H):
    """Stroke along circle (centre c, radius R) from angle a0 to a1 degrees (y down, clockwise
    on screen when a1>a0), round caps radius r."""
    if a1 < a0:
        a0, a1 = a1, a0
    big = 1 if (a1 - a0) > 180 else 0
    o0, o1 = pt(c, R + r, a0), pt(c, R + r, a1)
    i0, i1 = pt(c, R - r, a0), pt(c, R - r, a1)
    # outer a0->a1 (sweep 1), end cap a1 outer->inner (sweep 1 semicircle), inner back (sweep 0), start cap
    return "M%s %sA%s %s 0 %d 1 %s %sA%s %s 0 0 1 %s %sA%s %s 0 %d 0 %s %sA%s %s 0 0 1 %s %sZ" % (
        f(o0[0]), f(o0[1]), f(R + r), f(R + r), big, f(o1[0]), f(o1[1]),
        f(r), f(r), f(i1[0]), f(i1[1]),
        f(R - r), f(R - r), big, f(i0[0]), f(i0[1]),
        f(r), f(r), f(o0[0]), f(o0[1]))

def dot(c, r):
    return "M%s %sA%s %s 0 1 1 %s %sA%s %s 0 1 1 %s %sZ" % (
        f(c[0] - r), f(c[1]), f(r), f(r), f(c[0] + r), f(c[1]), f(r), f(r), f(c[0] - r), f(c[1]))

TOP, BOT = H, 100 - H      # stroke centre-lines for flat extremes
MID = 50
OV = 1.0                   # round overshoot
RO = 40.0                  # O / C centre-line radius

def G_P():
    x = H; R = 28
    cx = 20 + H
    return 71, [capsule((x, TOP), (x, BOT)), capsule((x, TOP), (cx, TOP)),
                capsule((x, TOP + 2 * R), (cx, TOP + 2 * R)), arc((cx, TOP + R), R, -90, 90)]
def G_O():
    c = (RO + H + 0.0, 50)
    return 2 * (RO + H), [arc(c, RO, -90, 90), arc(c, RO, 90, 270)]
def G_L():
    return 61, [capsule((H, TOP), (H, BOT)), capsule((H, BOT), (50, BOT))]
def G_U():
    w = 80; r = (w - W) / 2
    cy = 100 - H + OV - r
    return w, [capsule((H, TOP), (H, cy)), capsule((w - H, TOP), (w - H, cy)), arc((w / 2, cy), r, 0, 180)]
def G_T():
    w = 78
    return w, [capsule((H, TOP), (w - H, TOP)), capsule((w / 2, TOP), (w / 2, BOT))]
def G_E():
    return 66, [capsule((H, TOP), (H, BOT)), capsule((H, TOP), (55, TOP)), capsule((H, MID), (49, MID)), capsule((H, BOT), (55, BOT))]
def G_K():
    return 79, [capsule((H, TOP), (H, BOT)), capsule((69, TOP), (16, 55)), capsule((40, 38), (69, BOT))]
def G_DOT():
    r = 12.2
    return 2 * r, [dot((r, 100 - r + 0.3), r)]
def G_C():
    c = (RO + H, 50)
    a = 42
    ext = c[0] + RO * math.cos(math.radians(a)) + H
    return ext, [arc(c, RO, a, 360 - a)]
def G_M():
    w = 100
    return w, [capsule((H, TOP), (H, BOT)), capsule((w - H, TOP), (w - H, BOT)),
               capsule((H + 1, TOP + 2), (w / 2, 66)), capsule((w - H - 1, TOP + 2), (w / 2, 66))]

GL = {"P": G_P, "O": G_O, "L": G_L, "U": G_U, "T": G_T, "E": G_E, "K": G_K, ".": G_DOT, "C": G_C, "M": G_M}
# gaps (outer edge to outer edge) AFTER each glyph in POLUTEK.COM
word = ["P", "O", "L", "U", "T", "E", "K", ".", "C", "O", "M"]
GAP = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
gaps_default = {"P-O": 7, "O-L": 7, "L-U": 6, "U-T": 7, "T-E": 5, "E-K": 8, "K-.": 4, ".-C": 5, "C-O": 6, "O-M": 7}
gaps_default.update(GAP)

x = 0.0
ink, blue = [], []
for i, ch in enumerate(word):
    w, parts = GL[ch]()
    # horizontal translate inside path by wrapping coordinates: re-generate with offset via transform-free approach
    parts_x = []
    for p in parts:
        parts_x.append((x, p))
    (blue if i >= 7 else ink).extend(parts_x)
    if i < len(word) - 1:
        x += w + gaps_default["%s-%s" % (ch, word[i + 1])]
    else:
        x += w
TOTAL = x

import re
def shift(d, dx):
    # shift absolute coords; path commands used: M L A (A has radii/flags that are not shifted)
    out = []
    for m in re.finditer(r"([MLAZ])([^MLAZ]*)", d):
        cmd, args = m.group(1), m.group(2).strip()
        if cmd == "Z":
            out.append("Z"); continue
        nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", args)]
        if cmd in "ML":
            nums[0] += dx
        elif cmd == "A":
            nums[5] += dx
        # flags: re-emit
        if cmd == "A":
            out.append("A%s %s %s %d %d %s %s" % (f(nums[0]), f(nums[1]), f(nums[2]), int(nums[3]), int(nums[4]), f(nums[5]), f(nums[6])))
        else:
            out.append("%s%s %s" % (cmd, f(nums[0]), f(nums[1])))
    return "".join(out)

ink_d = "".join(shift(p, dx) for dx, p in ink)
blue_d = "".join(shift(p, dx) for dx, p in blue)
res = {"width": round(TOTAL, 2), "minY": -OV, "height": 100 + 2 * OV, "ink": ink_d, "blue": blue_d}
json.dump(res, open(sys.argv[2] if len(sys.argv) > 2 else "wordmark.json", "w"))
print("total width", TOTAL, "ink len", len(ink_d), "blue len", len(blue_d))
