#!/usr/bin/env bash
# Re-verify and restore exact digest-pinned IDs for config-only restarts of an active release.
set -euo pipefail
cd "${DEPLOY_APP_DIR:-$(dirname "$(readlink -f "$0")")}"

scope="${1:-}"
revision="${RELEASE_REVISION:-}"
proof_hash="${RELEASE_PROOF_SHA256:-}"
[[ "$scope" =~ ^(app|admin)$ ]] || { echo "usage: $0 app|admin" >&2; exit 2; }
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$proof_hash" =~ ^[a-f0-9]{64}$ ]] || { echo "RELEASE_REVISION and externally approved RELEASE_PROOF_SHA256 are required" >&2; exit 1; }
if [[ "$scope" == "admin" ]]; then active_revision="$(cat .current-admin-release-revision 2>/dev/null || true)";
else active_revision="$(cat .current-release-revision 2>/dev/null || true)"; fi
[[ "$active_revision" == "$revision" ]] || { echo "requested proof is not the active release" >&2; exit 1; }
state_dir=".release-state/$revision"
[[ -r "$state_dir/proof.sha256" && "$(cat "$state_dir/proof.sha256")" == "$proof_hash" ]] || { echo "approved proof does not match retained release state" >&2; exit 1; }
node "$state_dir/source/scripts/ops/deploy-release.mjs" \
  "--release-dir=$state_dir" "--revision=$revision" "--proof-sha256=$proof_hash" "--scope=$scope" "--tag=$revision"
