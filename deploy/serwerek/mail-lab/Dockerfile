# Mail lab: a send-only Postfix + OpenDKIM for the deliverability experiment (docs/operations/MAIL-LAB.md).
# Not part of the production stack: its own compose project, no published ports, started by hand.
FROM alpine:3.20

RUN apk add --no-cache postfix opendkim opendkim-utils ca-certificates tzdata bash \
 && mkdir -p /keys /var/spool/postfix /run/opendkim \
 && chown opendkim:opendkim /run/opendkim

COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY opendkim.conf /etc/opendkim/opendkim.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \n && chmod 644 /etc/postfix/main.cf /etc/postfix/master.cf

ENTRYPOINT ["/entrypoint.sh"]
