#!/bin/bash
# PP Support: zastosuj nazwe i ustawienia marki z overrides/brand.config.json w bazie panelu.
# Uruchamiac na serwerze: cd /opt/serwerek/apps/chatwoot && ./apply-brand.sh
# Po zmianie nazwy w brand.config.json uruchom tez: node workers/support-brand/deploy.mjs (z komputera wlasciciela).
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T -e PP_BRAND_JSON="$(cat overrides/brand.config.json)" -e PP_ACCOUNT_NAME="${PP_ACCOUNT_NAME:-}" web \
  bundle exec rails runner "$(cat apply-brand.rb)" 2>&1 | grep -v -i "ruby_llm\|RubyLLM\|rubyllm\|^$\|^W, "
