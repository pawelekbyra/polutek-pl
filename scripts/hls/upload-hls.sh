#!/usr/bin/env bash
# Uploads an encoded HLS folder to the private R2 bucket with rclone.
# Segments and variant playlists first, master.m3u8 LAST (atomic publication);
# meta.json stays local. The Worker sets Content-Type/Cache-Control itself.
#
#   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
#     scripts/hls/upload-hls.sh <out-dir> <videoId> <version> [bucket]
set -euo pipefail
dir="${1:?out dir}"; video="${2:?video id}"; version="${3:?version}"; bucket="${4:-polutek-hls}"
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" RCLONE_CONFIG_R2_REGION=auto
dest="R2:${bucket}/videos/${video}/v/${version}"
rclone copy "$dir" "$dest" --exclude master.m3u8 --exclude meta.json --s3-no-check-bucket --transfers 8 --stats-one-line
rclone copyto "$dir/master.m3u8" "$dest/master.m3u8" --s3-no-check-bucket
echo "uploaded to $dest"
