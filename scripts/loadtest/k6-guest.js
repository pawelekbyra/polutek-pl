// Guest-only, read-only load profile for www.pawelperfect.com (k6).
// Runs ON the server against http://127.0.0.1:3000 (never through Cloudflare). See README.md.
//
// Env:
//   TARGET     journey | home | sidebar | comments | media | thumb   (default journey)
//   RATE       iterations per second (constant arrival rate)        (default 2)
//   DURATION   e.g. 60s                                              (default 60s)
//   ITERATIONS if set: exactly this many iterations, one VU, sequential (used for query counting)
//   VIDEO_ID   id of a PUBLISHED, PUBLIC video without an upcoming premiere (required)
//   BASE       default http://127.0.0.1:3000
//   HOST_HEADER default www.pawelperfect.com
//   LOCALE     default pl
//   OUT        summary JSON path inside the container (default /out/summary.json)
import http from "k6/http";
import { Rate, Counter } from "k6/metrics";

const BASE = __ENV.BASE || "http://127.0.0.1:3000";
const HOST = __ENV.HOST_HEADER || "www.pawelperfect.com";
const VIDEO_ID = __ENV.VIDEO_ID;
const TARGET = __ENV.TARGET || "journey";
const RATE = Number(__ENV.RATE || 2);
const DURATION = __ENV.DURATION || "60s";
const LOCALE = __ENV.LOCALE || "pl";
const ITERATIONS = __ENV.ITERATIONS ? Number(__ENV.ITERATIONS) : 0;
// Marks every request (and every VideoPlaybackSession row it creates, via userAgentHash) as test traffic.
const UA = "pp-loadtest/1";

if (!VIDEO_ID) throw new Error("VIDEO_ID is required");

const serverErrors = new Rate("server_errors"); // 5xx or no response
const unexpected = new Counter("unexpected_status"); // anything that is not the expected status

const EPS = ["home", "sidebar", "comments", "media", "thumb"];
const thresholds = {
  // Hard safety fuse: more than 2% 5xx/timeouts aborts the run (evaluated after 10 s).
  server_errors: [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "10s" }],
};
// Dummy thresholds so per-endpoint percentiles appear in the summary JSON.
for (const ep of EPS) thresholds[`http_req_duration{ep:${ep}}`] = ["max>=0"];

const vus = Math.max(4, Math.min(150, Math.ceil(RATE * (TARGET === "journey" ? 3 : 1.5))));

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds,
  scenarios: ITERATIONS
    ? { load: { executor: "per-vu-iterations", vus: 1, iterations: ITERATIONS, maxDuration: "5m" } }
    : {
        load: {
          executor: "constant-arrival-rate",
          rate: RATE,
          timeUnit: "1s",
          duration: DURATION,
          preAllocatedVUs: vus,
          // Capped so k6 fits its 256 MB limit; running out of VUs shows up as dropped_iterations,
          // which only happens once responses are already slow (= the server is saturated).
          maxVUs: Math.min(150, vus * 2),
          gracefulStop: "5s",
        },
      },
};

// One fake client address per iteration, from 198.18.0.0/15 (RFC 2544, reserved for benchmarking).
// The app trusts CF-Connecting-IP (TRUST_CF_CONNECTING_IP=true behind the tunnel), so every iteration
// looks like a different new visitor, exactly like real traffic; per-IP rate limits behave as in production.
function fakeIp() {
  const a = 18 + Math.floor(Math.random() * 2);
  return `198.${a}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;
}

function params(ep, ip, accept) {
  return {
    headers: {
      Host: HOST,
      "User-Agent": UA,
      "CF-Connecting-IP": ip,
      "X-Forwarded-Proto": "https",
      "Accept-Language": LOCALE === "pl" ? "pl-PL,pl;q=0.9" : "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, br",
      Accept: accept || "application/json",
    },
    tags: { ep },
    redirects: 0,
    timeout: "30s",
  };
}

const REQ = {
  home: (ip) => ["GET", `${BASE}/${LOCALE}`, null, params("home", ip, "text/html,application/xhtml+xml")],
  sidebar: (ip) => ["GET", `${BASE}/api/channel/sidebar?currentVideoId=${VIDEO_ID}`, null, params("sidebar", ip)],
  comments: (ip) => ["GET", `${BASE}/api/comments?videoId=${VIDEO_ID}&sortBy=newest&limit=20`, null, params("comments", ip)],
  media: (ip) => ["GET", `${BASE}/api/media-source/${VIDEO_ID}`, null, params("media", ip)],
  thumb: (ip) => ["GET", `${BASE}/api/videos/${VIDEO_ID}/thumbnail`, null, params("thumb", ip, "image/avif,image/webp,*/*")],
};

function record(res) {
  serverErrors.add(res.status === 0 || res.status >= 500);
  if (res.status !== 200) unexpected.add(1, { status: String(res.status) });
}

export default function () {
  const ip = fakeIp();
  if (TARGET === "journey") {
    // What one new guest's first page view costs the origin: the SSR page first, then the
    // browser's parallel API calls (sidebar, comments, playback plan, one thumbnail via the proxy).
    record(http.request(...REQ.home(ip)));
    const rs = http.batch([REQ.sidebar(ip), REQ.comments(ip), REQ.media(ip), REQ.thumb(ip)]);
    for (const r of rs) record(r);
    return;
  }
  const make = REQ[TARGET];
  if (!make) throw new Error(`unknown TARGET ${TARGET}`);
  record(http.request(...make(ip)));
}

export function handleSummary(data) {
  return { [__ENV.OUT || "/out/summary.json"]: JSON.stringify(data) };
}
