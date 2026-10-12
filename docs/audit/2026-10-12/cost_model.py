#!/usr/bin/env python3
"""
Cost scaling model: pawelperfect.com single-creator site -> multi-channel UGC video platform.
Date of prices: 2026-10-12.  All money in USD unless suffixed _eur.  Run:  python cost_model.py

Every number tagged [REPO] comes from the repository docs/code, [PRICE] from an official price page
(see research_notes.md for URLs), [ASSUME] is an explicit assumption (change it, rerun).
"""
import math, json, sys

FX = 1.16  # [ASSUME] USD per EUR (not verified; only used to put Hetzner EUR prices next to Cloudflare USD)

# ----------------------------------------------------------------------------- video / viewer model
VIDEO_MIN = 8.0                       # [ASSUME] average video length, minutes (owner brief)
VIDEO_S = VIDEO_MIN * 60
WATCH_FRAC = 0.40                     # [ASSUME] average watched fraction (owner brief)
WATCHED_S = VIDEO_S * WATCH_FRAC      # 192 s
WATCHED_MIN = WATCHED_S / 60          # 3.2 min
SEG_S = 6                             # [REPO] HLS segment 6 s (encode-hls.mjs DEFAULTS.segmentSeconds)
# requests per view: segments + master + variant playlist(s) + init + a bit of ABR switching, +20 % for
# hover/idle warm-up prefetch (REPO: media-warmup.ts opens segments without a counted view)
REQ_OVERHEAD_FIXED = 6                # [ASSUME] master + 1-2 variant playlists + init(s) + poster
REQ_PREFETCH_FACTOR = 1.20            # [ASSUME]
def req_per_view(seg_s=SEG_S, prefetch=REQ_PREFETCH_FACTOR):
    return (math.ceil(WATCHED_S / seg_s) + REQ_OVERHEAD_FIXED) * prefetch
VIEWER_MBPS = 2.5                     # [ASSUME] average delivered bitrate (mix of 540p..1080p, mobile heavy)
MB_PER_VIEW = WATCHED_S * VIEWER_MBPS / 8

ORIG_MBPS = 12.0                      # [ASSUME] typical phone/camera 1080p30 source incl. audio
ORIG_GB = ORIG_MBPS * VIDEO_S / 8 / 1000          # ~0.72 GB
# [REPO] ladder caps (maxrate): 7.8+4.5+3.0+1.1+0.35 Mb/s video + 5 x 128k audio = 17.4 Mb/s ceiling.
# [ASSUME] capped-CRF averages ~55-60 % of the cap -> 10 Mb/s for the whole 5-rung ladder.
LADDER_CAP_MBPS = 7.8 + 4.5 + 3.0 + 1.1 + 0.35 + 5 * 0.128
LADDER_AVG_MBPS = 10.0
HLS_GB = LADDER_AVG_MBPS * VIDEO_S / 8 / 1000     # ~0.60 GB
RUNGS = 5                              # [REPO]
SEGMENTS_PER_RUNG = VIDEO_S / SEG_S    # 80
CLASS_A_PER_UPLOAD = RUNGS * SEGMENTS_PER_RUNG + RUNGS + (RUNGS + 1) + 1 \
    + math.ceil(ORIG_GB * 1024 / 16) + 3 + 10   # HLS PUTs + multipart parts(16 MiB) + create/complete + list/misc

# ----------------------------------------------------------------------------- prices [PRICE]
R2_STORAGE = 0.015      # $/GB-month, 10 GB free
R2_STORAGE_FREE_GB = 10
R2_IA_STORAGE = 0.010   # $/GB-month Infrequent Access (30 d minimum, $0.01/GB retrieval)
R2_A = 4.50             # $/M Class A, 1 M free
R2_A_FREE = 1.0
R2_B = 0.36             # $/M Class B, 10 M free
R2_B_FREE = 10.0
R2_EGRESS = 0.0
WORKERS_FREE_REQ_PER_DAY = 100_000
WORKERS_PAID_BASE = 5.0
WORKERS_PAID_INCL_REQ_M = 10.0
WORKERS_PAID_PER_M = 0.30
WORKERS_PAID_INCL_CPU_MS_M = 30.0
WORKERS_PAID_CPU_PER_M = 0.02
WORKER_CPU_MS = 2.0     # [ASSUME] CPU ms per HLS request (HMAC verify + cache lookup); NOT measured
# Hetzner, EUR/month net of VAT, from docs.hetzner.com price-adjustment (15 Jun 2026) unless noted
H_CPX22 = 19.49
H_CPX32 = 35.49
H_CCX13 = 42.99
H_CCX33 = 138.49
H_EX44_LTD = 57.30      # mirror of Hetzner price list (prismix.dev); "limited offering", supply-dependent
H_AX102 = 452.30        # AX102-1 (mirror)
H_AX162 = 612.30        # AX162-1 (mirror)
H_IPV4 = 0.50

# managed
STREAM_STORE_PER_1000MIN = 5.0
STREAM_DELIV_PER_1000MIN = 1.0
MUX_FREE_DELIV_MIN = 100_000
MUX_STORE_1080 = [(50_000, 0.0030), (100_000, 0.0029), (100_000, 0.00285), (None, 0.0028)]
MUX_STORE_720 = [(50_000, 0.0024), (100_000, 0.00232), (100_000, 0.00228), (None, 0.00224)]
MUX_DELIV_1080 = [(500_000, 0.001), (500_000, 0.00095), (1_000_000, 0.0009), (4_000_000, 0.000838),
                  (4_000_000, 0.000763), (None, 0.0007)]
MUX_DELIV_720 = [(500_000, 0.0008), (500_000, 0.00076), (1_000_000, 0.00072), (4_000_000, 0.00067),
                 (4_000_000, 0.00061), (None, 0.00056)]
BUNNY_STORE_GB = 0.01   # default region; replication +0.01 for 2nd region
BUNNY_DELIV_STD = 0.010 # Europe & North America standard network
BUNNY_DELIV_VOL = 0.005 # volume network 0-500 TB
APIVIDEO_STORE_MIN = 0.00285
APIVIDEO_DELIV_MIN = 0.0017

# ----------------------------------------------------------------------------- encoder model
# [REPO] pilot: 720p 10 s clip = 13.5 s on CPX22 (1.3x real time); docs: "normal tempo 1-3x real time on
# 2 vCPU, preset slow; medium ~1.5-2x faster". 1080p ladder with 5 rungs, 8 min: NOT measured.
VCPU_S_PER_VIDEO_S = {"slow": 4.0, "medium": 2.4, "veryfast": 1.2}   # [ASSUME] central; slow range 2..6
EX44_VCPU_EQ = 12.0                  # [ASSUME] i5-13500 (20 threads) ~ 12 CPX22-vCPU equivalents; BENCHMARK IT
ENC_UTIL = 0.70                      # [ASSUME] sustainable utilisation
PEAK_UPLOAD_FACTOR = 3.0             # [ASSUME] busiest hour vs average hour of uploads
APP_PEAK_FACTOR = 8.0                # [ASSUME] peak second vs month-average second
VISITS_PER_VIEW = 1.3                # [ASSUME]
APP_VISITS_PER_S_EX44 = 80.0         # [ASSUME] from LOAD-TEST: 16 visits/s on 2 vCPU (uncached home page)

# ----------------------------------------------------------------------------- DB growth model
# [REPO] per counted view: 1-2 VideoPlaybackSession rows (also created by hover/idle prefetch), events:
# PLAY_STARTED, HEARTBEAT every 60 s (~3), PAUSED/ENDED, WATCHED_10_SECONDS ~ 6 rows; no pruning of events.
SESSION_ROWS_PER_VIEW = 2
EVENT_ROWS_PER_VIEW = 6
BYTES_SESSION_ROW = 400   # [ASSUME] row + 6 indexes
BYTES_EVENT_ROW = 500     # [ASSUME] row + 5 indexes (uuid PK -> random insert)
DB_WRITES_PER_VIEW = 12   # inserts + updates (session updates per heartbeat)
TELEMETRY_ROWS_PER_VISIT = 3
BYTES_TELEMETRY_ROW = 150
TELEMETRY_RETENTION_DAYS = 90   # [REPO]

SCENARIOS = [
    # name, channels, videos, views/mo, uploads/mo
    ("S0", 1, 10, 10_000, 2),
    ("S1", 50, 2_000, 100_000, 400),
    ("S2", 500, 20_000, 2_000_000, 4_000),
    ("S3", 5_000, 200_000, 30_000_000, 40_000),
    ("S4", 50_000, 2_000_000, 300_000_000, 400_000),
]

def tier_cost(amount, tiers):
    cost, left = 0.0, amount
    for size, price in tiers:
        take = left if size is None else min(left, size)
        cost += take * price
        left -= take
        if left <= 0:
            break
    return cost

def diy(name, channels, videos, views, uploads, *, preset="slow", miss=0.5, keep_originals=True,
        orig_ia=False, worker_segments=True, seg_s=SEG_S, backup_originals=True, tiered_miss=None, hls_mbps=None, verbose=False):
    out = {}
    rpv = req_per_view(seg_s)
    req = views * rpv                                   # worker requests / month
    out["worker_req_M"] = req / 1e6
    out["req_per_view"] = rpv
    # --- R2 storage
    orig_gb_total = videos * ORIG_GB if keep_originals else 0.0
    hls_gb = (hls_mbps or LADDER_AVG_MBPS) * VIDEO_S / 8 / 1000
    hls_gb_total = videos * hls_gb
    stor_price_orig = R2_IA_STORAGE if orig_ia else R2_STORAGE
    out["r2_storage"] = max(0, hls_gb_total - R2_STORAGE_FREE_GB) * R2_STORAGE + orig_gb_total * stor_price_orig
    out["storage_TB"] = (orig_gb_total + hls_gb_total) / 1000
    # --- R2 operations
    class_a = uploads * CLASS_A_PER_UPLOAD / 1e6
    out["r2_class_a"] = max(0, class_a - R2_A_FREE) * R2_A
    m = miss if tiered_miss is None else tiered_miss
    if worker_segments:
        class_b = req * m / 1e6
    else:
        # segments go through CDN cache on an R2 custom domain; only misses read R2
        class_b = req * m / 1e6
    out["r2_class_b"] = max(0, class_b - R2_B_FREE) * R2_B
    # --- Workers
    if worker_segments:
        w_req = req / 1e6
        cpu_ms_M = w_req * WORKER_CPU_MS
        base = WORKERS_PAID_BASE
    else:
        w_req = views * 4 / 1e6            # playlists / token only
        cpu_ms_M = w_req * WORKER_CPU_MS
        base = WORKERS_PAID_BASE + 25.0    # + Cloudflare Pro for WAF HMAC rule (repo doc: 20-25 USD) [UNVERIFIED]
    paid = base + max(0, w_req - WORKERS_PAID_INCL_REQ_M) * WORKERS_PAID_PER_M \
        + max(0, cpu_ms_M - WORKERS_PAID_INCL_CPU_MS_M) * WORKERS_PAID_CPU_PER_M
    free_ok = (req / 30) <= WORKERS_FREE_REQ_PER_DAY
    out["workers"] = 0.0 if (free_ok and worker_segments) else paid
    out["workers_free_ok"] = free_ok
    # --- encoding fleet (peak-hour sized)
    vcpu_s = VCPU_S_PER_VIDEO_S[preset] * VIDEO_S
    ex44_s = vcpu_s / EX44_VCPU_EQ                         # wall seconds per video on one EX44
    per_machine_per_month = 30 * 86400 * ENC_UTIL / ex44_s
    peak_per_hour = uploads / 30 / 24 * PEAK_UPLOAD_FACTOR
    per_machine_per_hour = 3600 * ENC_UTIL / ex44_s
    n_avg = uploads / per_machine_per_month
    n_peak = peak_per_hour / per_machine_per_hour
    out["enc_s_per_video_on_ex44"] = ex44_s
    out["enc_vcpu_hours"] = uploads * vcpu_s / 3600
    out["enc_machines_avg"] = n_avg
    out["enc_machines_peak"] = n_peak
    if name in ("S0",):
        n_enc, enc_cost = 0, 0.0           # shared with the production server (REPO status quo)
    elif name == "S1":
        n_enc, enc_cost = 0, 0.0           # shared on a CPX32 together with the app (see app tier)
    else:
        n_enc = max(1, math.ceil(n_peak))
        enc_cost = n_enc * (H_EX44_LTD + H_IPV4) * FX
    out["enc_machines"] = n_enc
    out["encoding"] = enc_cost
    # --- app + DB tier
    visits = views * VISITS_PER_VIEW
    peak_visits_s = visits / (30 * 86400) * APP_PEAK_FACTOR
    out["peak_visits_s"] = peak_visits_s
    if name == "S0":
        app_eur = H_CPX22 + H_IPV4
        app_desc = "1x CPX22 (obecny serwerek)"
    elif name == "S1":
        app_eur = H_CPX32 + H_IPV4
        app_desc = "1x CPX32 (app+DB+encoder)"
    elif name == "S2":
        app_eur = 1 * (H_EX44_LTD + H_IPV4)
        app_desc = "1x EX44 (app+DB), encoder osobno"
    elif name == "S3":
        n_app = math.ceil(peak_visits_s / APP_VISITS_PER_S_EX44) + 1
        app_eur = (n_app + 2) * (H_EX44_LTD + H_IPV4)
        app_desc = f"{n_app}x EX44 app + 2x EX44 Postgres (primary+replika)"
    else:
        n_app = math.ceil(peak_visits_s / APP_VISITS_PER_S_EX44) + 2
        app_eur = n_app * (H_EX44_LTD + H_IPV4) + H_AX162 + 3 * H_AX102 + 150
        app_desc = f"{n_app}x EX44 app + klaster PG (1x AX162 + 3x AX102) + Redis/kolektor"
    out["app_tier"] = app_eur * FX
    out["app_desc"] = app_desc
    # --- DB size & backups (no retention policy = current code)
    playback_gb_per_month = views * (SESSION_ROWS_PER_VIEW * BYTES_SESSION_ROW + EVENT_ROWS_PER_VIEW * BYTES_EVENT_ROW) / 1e9
    telemetry_gb = visits * TELEMETRY_ROWS_PER_VISIT * BYTES_TELEMETRY_ROW * (TELEMETRY_RETENTION_DAYS / 30) / 1e9
    out["db_growth_gb_month"] = playback_gb_per_month
    out["db_year1_gb"] = playback_gb_per_month * 12 + telemetry_gb
    out["db_writes_s_avg"] = views * DB_WRITES_PER_VIEW / (30 * 86400)
    out["db_writes_s_peak"] = out["db_writes_s_avg"] * APP_PEAK_FACTOR
    dump_gb = out["db_year1_gb"] * 0.25                      # gzip dump ~25 %
    out["backup_db"] = max(0, dump_gb * 15 - R2_STORAGE_FREE_GB) * R2_STORAGE   # 15 days in R2 (REPO)
    out["backup_originals"] = (videos * ORIG_GB * R2_IA_STORAGE) if (backup_originals and keep_originals and name != "S0") else 0.0
    # --- monitoring / misc (rough)
    out["monitoring"] = {"S0": 0, "S1": 10, "S2": 50, "S3": 300, "S4": 3000}[name]
    # --- delivery bandwidth (info) and egress cost
    out["delivered_TB"] = views * MB_PER_VIEW / 1e6
    out["egress"] = R2_EGRESS
    comp = ["r2_storage", "r2_class_a", "r2_class_b", "workers", "encoding", "app_tier",
            "backup_db", "backup_originals", "monitoring"]
    out["total"] = sum(out[c] for c in comp)
    out["per_1k_views"] = out["total"] / views * 1000
    watched_h = views * WATCHED_MIN / 60
    out["per_watched_hour"] = out["total"] / watched_h
    out["watched_hours"] = watched_h
    out["components"] = {c: out[c] for c in comp}
    out["dominant"] = max(out["components"], key=out["components"].get)
    return out

def managed(name, channels, videos, views, uploads, app_tier_usd):
    stored_min = videos * VIDEO_MIN
    deliv_min = views * WATCHED_MIN
    res = {}
    res["Cloudflare Stream"] = stored_min / 1000 * STREAM_STORE_PER_1000MIN + deliv_min / 1000 * STREAM_DELIV_PER_1000MIN
    res["Mux 1080p basic"] = tier_cost(stored_min, MUX_STORE_1080) + tier_cost(max(0, deliv_min - MUX_FREE_DELIV_MIN), MUX_DELIV_1080)
    res["Mux 720p basic"] = tier_cost(stored_min, MUX_STORE_720) + tier_cost(max(0, deliv_min - MUX_FREE_DELIV_MIN), MUX_DELIV_720)
    gb_delivered = views * MB_PER_VIEW / 1000
    gb_stored = videos * (ORIG_GB + HLS_GB)
    res["Bunny Stream (volume net)"] = gb_stored * BUNNY_STORE_GB + gb_delivered * BUNNY_DELIV_VOL
    res["Bunny Stream (standard net)"] = gb_stored * BUNNY_STORE_GB + gb_delivered * BUNNY_DELIV_STD
    res["api.video"] = stored_min * APIVIDEO_STORE_MIN + deliv_min * APIVIDEO_DELIV_MIN
    return res

def fmt(x):
    return f"{x:,.0f}" if x >= 100 else f"{x:,.2f}"

def main():
    md = []
    P = md.append
    P("## Assumed unit values")
    P(f"- watched per view: {WATCHED_MIN:.1f} min ({WATCHED_S:.0f} s); requests/view (6 s segments): {req_per_view():.0f}; MB/view: {MB_PER_VIEW:.0f}")
    P(f"- original {ORIG_GB:.2f} GB, HLS ladder {HLS_GB:.2f} GB (cap would be {LADDER_CAP_MBPS*VIDEO_S/8/1000:.2f} GB) -> {ORIG_GB+HLS_GB:.2f} GB/video")
    P(f"- R2 Class A ops per upload: {CLASS_A_PER_UPLOAD:.0f}")
    for p in VCPU_S_PER_VIDEO_S:
        s = VCPU_S_PER_VIDEO_S[p] * VIDEO_S / EX44_VCPU_EQ
        P(f"- encode preset {p}: {VCPU_S_PER_VIDEO_S[p]} vCPU-s per video-s -> {s:.0f} s per 8-min video on one EX44-class box "
          f"({3600*ENC_UTIL/s:.0f} videos/h, {30*86400*ENC_UTIL/s:,.0f}/month)")
    P("")
    P("## DIY on Cloudflare R2 + Workers + Hetzner (current architecture, scaled), USD/month")
    hdr = "| scen | channels | videos | views/mo | uploads/mo | Worker req/mo | R2 TB | R2 stor | R2 A | R2 B | Workers | encode | app+DB | backup | monit. | **TOTAL** | $/1k views | $/watched h | dominant |"
    P(hdr)
    P("|" + "---|" * 19)
    results = {}
    for sc in SCENARIOS:
        r = diy(*sc)
        results[sc[0]] = r
        P(f"| {sc[0]} | {sc[1]:,} | {sc[2]:,} | {sc[3]:,} | {sc[4]:,} | {r['worker_req_M']:,.1f}M | {r['storage_TB']:,.1f} | "
          f"{fmt(r['r2_storage'])} | {fmt(r['r2_class_a'])} | {fmt(r['r2_class_b'])} | {fmt(r['workers'])} | {fmt(r['encoding'])} | "
          f"{fmt(r['app_tier'])} | {fmt(r['backup_db']+r['backup_originals'])} | {fmt(r['monitoring'])} | **{fmt(r['total'])}** | "
          f"{r['per_1k_views']:.2f} | {r['per_watched_hour']:.3f} | {r['dominant']} |")
    P("")
    P("## Capacity / breakage indicators")
    P("| scen | app tier | enc s/video (EX44) | enc machines avg/peak | peak visits/s | DB writes/s avg/peak | DB growth GB/mo | DB size y1 GB | delivered TB/mo | Worker free cap OK? |")
    P("|" + "---|" * 10)
    for sc in SCENARIOS:
        r = results[sc[0]]
        P(f"| {sc[0]} | {r['app_desc']} | {r['enc_s_per_video_on_ex44']:.0f} | {r['enc_machines_avg']:.1f}/{r['enc_machines_peak']:.1f} | "
          f"{r['peak_visits_s']:.1f} | {r['db_writes_s_avg']:.0f}/{r['db_writes_s_peak']:.0f} | {r['db_growth_gb_month']:.1f} | "
          f"{r['db_year1_gb']:.0f} | {r['delivered_TB']:,.0f} | {'yes' if r['workers_free_ok'] else 'NO'} |")
    P("")
    P("## Optimised DIY (originals in R2-IA, 10 s segments, segments via R2 custom domain + CDN cache w/ WAF HMAC on Pro, tiered-cache miss 25 %, preset medium), USD/month")
    P("| scen | TOTAL | $/1k views | vs baseline |")
    P("|---|---|---|---|")
    for sc in SCENARIOS:
        r = diy(*sc, preset="medium", orig_ia=True, worker_segments=False, seg_s=10, tiered_miss=0.25)
        P(f"| {sc[0]} | {fmt(r['total'])} | {r['per_1k_views']:.2f} | {r['total']/results[sc[0]]['total']*100:.0f}% |")
    P("")
    P("## Lean DIY (originals deleted after encode => no original backup, 6 Mb/s avg ladder (3-4 rungs / higher CRF), 10 s segments, CDN-cached segments, preset medium), USD/month")
    P("| scen | TOTAL | $/1k views | vs baseline | storage TB |")
    P("|---|---|---|---|---|")
    for sc in SCENARIOS:
        r = diy(*sc, preset="medium", keep_originals=False, worker_segments=False, seg_s=10, tiered_miss=0.25, hls_mbps=6.0)
        P(f"| {sc[0]} | {fmt(r['total'])} | {r['per_1k_views']:.2f} | {r['total']/results[sc[0]]['total']*100:.0f}% | {r['storage_TB']:,.1f} |")
    P("")
    P("## Sensitivity: cache-miss ratio / Worker CPU (S3, baseline arch.)")
    for mr in (0.2, 0.5, 0.8):
        r = diy(*SCENARIOS[3], miss=mr)
        P(f"- miss {mr:.0%}: R2 class B ${r['r2_class_b']:,.0f}, total ${r['total']:,.0f}")
    P("")
    P("## Managed video + same app tier (USD/month)")
    P("| scen | app tier | Stream | Mux 1080p | Mux 720p | Bunny vol | Bunny std | api.video | DIY baseline | DIY optimised |")
    P("|---|---|---|---|---|---|---|---|---|---|")
    for sc in SCENARIOS:
        r = results[sc[0]]
        app = r["app_tier"] if sc[0] not in ("S0",) else r["app_tier"]
        m = managed(*sc, app)
        ropt = diy(*sc, preset="medium", orig_ia=True, worker_segments=False, seg_s=10, tiered_miss=0.25)
        P(f"| {sc[0]} | {fmt(app)} | " + " | ".join(fmt(m[k] + app) for k in ["Cloudflare Stream", "Mux 1080p basic", "Mux 720p basic",
            "Bunny Stream (volume net)", "Bunny Stream (standard net)", "api.video"]) + f" | {fmt(r['total'])} | {fmt(ropt['total'])} |")
    P("")
    P("(managed columns = video platform cost + the same application/DB tier, without encoder fleet; "
      "S0 managed numbers include the 100k free Mux minutes)")
    P("")
    P("## Managed video only (no app tier), USD/month, and $/1k views")
    for sc in SCENARIOS:
        m = managed(*sc, 0)
        P(f"- {sc[0]}: " + "; ".join(f"{k} ${fmt(v)} (${v/sc[3]*1000:.2f}/1k)" for k, v in m.items()))
    print("\n".join(md))
    with open(__file__.replace("cost_model.py", "cost_model_output.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

if __name__ == "__main__":
    main()
