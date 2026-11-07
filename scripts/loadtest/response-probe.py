#!/usr/bin/env python3
"""Bounded, one-shot semantic probe for the guest load-test HTML and thumbnail routes."""
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_PREFIX_BYTES = 64 * 1024
TIMEOUT_SECONDS = 5
USER_AGENT_PREFIX = "pp-loadtest/"
EXPECTED_HOME_TITLE = "www.pawelperfect.com"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def image_signature_matches(content_type, body):
    if content_type == "image/png":
        return body.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type in ("image/jpeg", "image/jpg"):
        return body.startswith(b"\xff\xd8\xff")
    if content_type == "image/webp":
        return len(body) >= 12 and body[:4] == b"RIFF" and body[8:12] == b"WEBP"
    if content_type == "image/gif":
        return body.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/avif":
        if len(body) < 16 or body[4:8] != b"ftyp":
            return False
        brands = [body[8:12]] + [body[offset:offset + 4] for offset in range(16, min(len(body), 64), 4)]
        return any(brand in (b"avif", b"avis") for brand in brands)
    return False


def validate_response(endpoint, status, content_type, prefix):
    if status != 200:
        return "expected HTTP 200"
    if endpoint == "home":
        if content_type not in ("text/html", "application/xhtml+xml"):
            return "expected HTML content type"
        if b"<html" not in prefix.lower():
            return "HTML document marker missing from bounded prefix"
        title = re.search(rb"<title\b[^>]*>(.*?)</title\s*>", prefix, flags=re.IGNORECASE | re.DOTALL)
        if not title or EXPECTED_HOME_TITLE.encode() not in title.group(1).lower():
            return "expected site title missing from bounded HTML prefix"
        return None
    if endpoint == "thumb":
        if not content_type.startswith("image/"):
            return "expected image content type"
        if not image_signature_matches(content_type, prefix):
            return "image signature does not match content type or supported format"
        return None
    return "endpoint must be home or thumb"


def read_bounded_prefix(response, limit):
    prefix = bytearray()
    while len(prefix) <= limit:
        chunk = response.read1(min(8192, limit + 1 - len(prefix)))
        if not chunk:
            break
        prefix.extend(chunk)
    return bytes(prefix)


def main(argv):
    if len(argv) != 6:
        print("usage: response-probe.py <home|thumb> <loopback-url> <host-header> <user-agent> <max-prefix-bytes>", file=sys.stderr)
        return 2
    endpoint, url, host, user_agent, limit_text = argv[1:]
    if endpoint not in ("home", "thumb"):
        print("unsupported endpoint", file=sys.stderr)
        return 2
    try:
        limit = int(limit_text)
    except ValueError:
        print("max-prefix-bytes must be an integer", file=sys.stderr)
        return 2
    if limit != MAX_PREFIX_BYTES:
        print("max-prefix-bytes must equal the fixed 65536-byte safety bound", file=sys.stderr)
        return 2
    parsed = urlsplit(url)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "::1") or parsed.username or parsed.password:
        print("response probe only permits an HTTP loopback target", file=sys.stderr)
        return 2
    if not host or any(char in host for char in "\r\n"):
        print("invalid Host header", file=sys.stderr)
        return 2
    if not user_agent.startswith(USER_AGENT_PREFIX) or len(user_agent) > 64 or any(char in user_agent for char in "\r\n"):
        print("invalid load-test User-Agent", file=sys.stderr)
        return 2

    accept = "text/html,application/xhtml+xml" if endpoint == "home" else "image/avif,image/webp,*/*"
    request = Request(url, headers={
        "Accept": accept,
        "Accept-Encoding": "identity",
        "Host": host,
        "User-Agent": user_agent,
    })
    try:
        try:
            response = build_opener(NoRedirect).open(request, timeout=TIMEOUT_SECONDS)
        except HTTPError as error:
            response = error
        with response:
            status = response.code
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            prefix = read_bounded_prefix(response, limit) if status == 200 else b""
    except (URLError, TimeoutError, OSError) as error:
        print(json.dumps({"ok": False, "error": f"loopback request failed: {type(error).__name__}"}))
        return 1

    inspected = min(len(prefix), limit)
    reason = validate_response(endpoint, status, content_type, prefix[:limit])
    result = {
        "ok": reason is None,
        "endpoint": endpoint,
        "status": status,
        "content_type": content_type,
        "max_prefix_bytes": limit,
        "bytes_inspected": inspected,
        "truncated": len(prefix) > limit,
    }
    if reason:
        result["error"] = reason
    print(json.dumps(result, sort_keys=True))
    return 0 if reason is None else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
