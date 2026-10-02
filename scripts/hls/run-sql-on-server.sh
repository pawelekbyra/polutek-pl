# usage: sqlrun.sh <video_id> <file.sql> [extra psql args]
cd /opt/serwerek/data/hls-work
vid="$1"; f="$2"; shift 2
docker exec -i polutek-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -v ON_ERROR_STOP=1 -P pager=off -v video_id=$vid -v version=v1 $*" < "$f"
