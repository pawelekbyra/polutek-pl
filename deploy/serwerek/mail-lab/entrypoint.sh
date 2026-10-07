#!/bin/bash
# Starts OpenDKIM (background) and Postfix (foreground). The DKIM key lives in the /keys volume and is
# created on first start (2048-bit); the public key to publish is printed to the log.
set -euo pipefail

if [ ! -f /keys/lab1.private ]; then
  echo "[mail-lab] generating a 2048-bit DKIM key (selector lab1)"
  opendkim-genkey -b 2048 -d lab.pawelperfect.com -s lab1 -D /keys
  mv /keys/lab1.private /keys/lab1.private.tmp && mv /keys/lab1.private.tmp /keys/lab1.private
fi
chown opendkim:opendkim /keys/lab1.private
chmod 600 /keys/lab1.private
echo "[mail-lab] DKIM public record to publish at lab1._domainkey.lab.pawelperfect.com:"
cat /keys/lab1.txt || true

opendkim -x /etc/opendkim/opendkim.conf
postfix check
exec postfix start-fg
