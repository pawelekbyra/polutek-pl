## Assumed unit values
- watched per view: 3.2 min (192 s); requests/view (6 s segments): 46; MB/view: 60
- original 0.72 GB, HLS ladder 0.60 GB (cap would be 1.04 GB) -> 1.32 GB/video
- R2 Class A ops per upload: 472
- encode preset slow: 4.0 vCPU-s per video-s -> 160 s per 8-min video on one EX44-class box (16 videos/h, 11,340/month)
- encode preset medium: 2.4 vCPU-s per video-s -> 96 s per 8-min video on one EX44-class box (26 videos/h, 18,900/month)
- encode preset veryfast: 1.2 vCPU-s per video-s -> 48 s per 8-min video on one EX44-class box (52 videos/h, 37,800/month)

## DIY on Cloudflare R2 + Workers + Hetzner (current architecture, scaled), USD/month
| scen | channels | videos | views/mo | uploads/mo | Worker req/mo | R2 TB | R2 stor | R2 A | R2 B | Workers | encode | app+DB | backup | monit. | **TOTAL** | $/1k views | $/watched h | dominant |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 | 1 | 10 | 10,000 | 2 | 0.5M | 0.0 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | 23.19 | 0.00 | 0.00 | **23.30** | 2.33 | 0.044 | app_tier |
| S1 | 50 | 2,000 | 100,000 | 400 | 4.6M | 2.6 | 39.45 | 0.00 | 0.00 | 5.00 | 0.00 | 41.75 | 14.52 | 10.00 | **111** | 1.11 | 0.021 | app_tier |
| S2 | 500 | 20,000 | 2,000,000 | 4,000 | 91.2M | 26.4 | 396 | 4.00 | 12.82 | 32.41 | 134 | 67.05 | 149 | 50.00 | **845** | 0.42 | 0.008 | r2_storage |
| S3 | 5,000 | 200,000 | 30,000,000 | 40,000 | 1,368.0M | 264.0 | 3,960 | 80.46 | 243 | 467 | 738 | 335 | 1,520 | 300 | **7,642** | 0.25 | 0.005 | r2_storage |
| S4 | 50,000 | 2,000,000 | 300,000,000 | 400,000 | 13,680.0M | 2,640.0 | 39,600 | 845 | 2,459 | 4,653 | 7,107 | 3,665 | 15,199 | 3,000 | **76,528** | 0.26 | 0.005 | r2_storage |

## Capacity / breakage indicators
| scen | app tier | enc s/video (EX44) | enc machines avg/peak | peak visits/s | DB writes/s avg/peak | DB growth GB/mo | DB size y1 GB | delivered TB/mo | Worker free cap OK? |
|---|---|---|---|---|---|---|---|---|---|
| S0 | 1x CPX22 (obecny serwerek) | 160 | 0.0/0.0 | 0.0 | 0/0 | 0.0 | 0 | 1 | yes |
| S1 | 1x CPX32 (app+DB+encoder) | 160 | 0.0/0.1 | 0.4 | 0/4 | 0.4 | 5 | 6 | NO |
| S2 | 1x EX44 (app+DB), encoder osobno | 160 | 0.4/1.1 | 8.0 | 9/74 | 7.6 | 95 | 120 | NO |
| S3 | 3x EX44 app + 2x EX44 Postgres (primary+replika) | 160 | 3.5/10.6 | 120.4 | 139/1111 | 114.0 | 1421 | 1,800 | NO |
| S4 | 18x EX44 app + klaster PG (1x AX162 + 3x AX102) + Redis/kolektor | 160 | 35.3/105.8 | 1203.7 | 1389/11111 | 1140.0 | 14206 | 18,000 | NO |

## Optimised DIY (originals in R2-IA, 10 s segments, segments via R2 custom domain + CDN cache w/ WAF HMAC on Pro, tiered-cache miss 25 %, preset medium), USD/month
| scen | TOTAL | $/1k views | vs baseline |
|---|---|---|---|
| S0 | 53.26 | 5.33 | 229% |
| S1 | 129 | 1.29 | 116% |
| S2 | 693 | 0.35 | 82% |
| S3 | 6,092 | 0.20 | 80% |
| S4 | 60,673 | 0.20 | 79% |

## Lean DIY (originals deleted after encode => no original backup, 6 Mb/s avg ladder (3-4 rungs / higher CRF), 10 s segments, CDN-cached segments, preset medium), USD/month
| scen | TOTAL | $/1k views | vs baseline | storage TB |
|---|---|---|---|---|
| S0 | 53.19 | 5.32 | 228% | 0.0 |
| S1 | 92.51 | 0.93 | 84% | 0.7 |
| S2 | 333 | 0.17 | 39% | 7.2 |
| S3 | 2,492 | 0.08 | 33% | 72.0 |
| S4 | 24,673 | 0.08 | 32% | 720.0 |

## Sensitivity: cache-miss ratio / Worker CPU (S3, baseline arch.)
- miss 20%: R2 class B $95, total $7,494
- miss 50%: R2 class B $243, total $7,642
- miss 80%: R2 class B $390, total $7,790

## Managed video + same app tier (USD/month)
| scen | app tier | Stream | Mux 1080p | Mux 720p | Bunny vol | Bunny std | api.video | DIY baseline | DIY optimised |
|---|---|---|---|---|---|---|---|---|---|
| S0 | 23.19 | 55.59 | 23.43 | 23.38 | 26.32 | 29.32 | 77.82 | 23.30 | 53.26 |
| S1 | 41.75 | 442 | 310 | 256 | 98.15 | 128 | 631 | 111 | 129 |
| S2 | 67.05 | 7,267 | 5,991 | 4,805 | 931 | 1,531 | 11,403 | 845 | 693 |
| S3 | 335 | 104,335 | 73,249 | 58,663 | 11,975 | 20,975 | 168,095 | 7,642 | 6,092 |
| S4 | 3,665 | 1,043,665 | 721,699 | 578,089 | 120,065 | 210,065 | 1,681,265 | 76,528 | 60,673 |

(managed columns = video platform cost + the same application/DB tier, without encoder fleet; S0 managed numbers include the 100k free Mux minutes)

## Managed video only (no app tier), USD/month, and $/1k views
- S0: Cloudflare Stream $32.40 ($3.24/1k); Mux 1080p basic $0.24 ($0.02/1k); Mux 720p basic $0.19 ($0.02/1k); Bunny Stream (volume net) $3.13 ($0.31/1k); Bunny Stream (standard net) $6.13 ($0.61/1k); api.video $54.63 ($5.46/1k)
- S1: Cloudflare Stream $400 ($4.00/1k); Mux 1080p basic $268 ($2.68/1k); Mux 720p basic $214 ($2.14/1k); Bunny Stream (volume net) $56.40 ($0.56/1k); Bunny Stream (standard net) $86.40 ($0.86/1k); api.video $590 ($5.90/1k)
- S2: Cloudflare Stream $7,200 ($3.60/1k); Mux 1080p basic $5,924 ($2.96/1k); Mux 720p basic $4,738 ($2.37/1k); Bunny Stream (volume net) $864 ($0.43/1k); Bunny Stream (standard net) $1,464 ($0.73/1k); api.video $11,336 ($5.67/1k)
- S3: Cloudflare Stream $104,000 ($3.47/1k); Mux 1080p basic $72,914 ($2.43/1k); Mux 720p basic $58,328 ($1.94/1k); Bunny Stream (volume net) $11,640 ($0.39/1k); Bunny Stream (standard net) $20,640 ($0.69/1k); api.video $167,760 ($5.59/1k)
- S4: Cloudflare Stream $1,040,000 ($3.47/1k); Mux 1080p basic $718,034 ($2.39/1k); Mux 720p basic $574,424 ($1.91/1k); Bunny Stream (volume net) $116,400 ($0.39/1k); Bunny Stream (standard net) $206,400 ($0.69/1k); api.video $1,677,600 ($5.59/1k)
