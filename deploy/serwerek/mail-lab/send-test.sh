#!/bin/bash
# Sends one plain test message through the mail lab to a seed mailbox the owner controls.
#   ./send-test.sh <to-address> ["subject"]
# Only for seed mailboxes: never for real users. Looks at the queue/log afterwards:
#   docker logs --tail 40 pp-mail-lab
set -euo pipefail
to="${1:?usage: $0 <to-address> [subject]}"
subject="${2:-Test dostarczalnosci z serwerka (lab)}"
case "$to" in *@*) ;; *) echo "bad address"; exit 1;; esac
id="$(date -u +%Y%m%d%H%M%S)-$RANDOM"
docker exec -i pp-mail-lab sendmail -t -i -f lab@lab.pawelperfect.com <<EOF
From: Pawel Perfect <lab@lab.pawelperfect.com>
To: $to
Reply-To: support@pawelperfect.com
Subject: $subject [$id]
Message-ID: <$id@lab.pawelperfect.com>
Date: $(date -R)
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Auto-Submitted: auto-generated

Czesc,

to test dostarczalnosci poczty wysylanej z wlasnego serwera pawelperfect.com (eksperyment, nie prawdziwy mail z aplikacji).
Sprawdz prosze, czy ta wiadomosc jest w Odebranych czy w Spamie, i odpisz jednym slowem.

Pawel
EOF
echo "queued: $id -> $to"
