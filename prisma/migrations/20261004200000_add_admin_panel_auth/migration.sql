-- Admin panel identity (apps/admin, admin.pawelperfect.com): a separate Better Auth instance with its own
-- tables, the one-time enrollment links and an append-only sign-in log. Additive and idempotent.
-- docs/architecture/admin-panel.md, docs/operations/ADMIN-PANEL.md.

CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "enrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");

CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "stepUpAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_token_key" ON "AdminSession"("token");
CREATE INDEX IF NOT EXISTS "AdminSession_userId_idx" ON "AdminSession"("userId");

CREATE TABLE IF NOT EXISTS "AdminAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAccount_userId_idx" ON "AdminAccount"("userId");

CREATE TABLE IF NOT EXISTS "AdminVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminVerification_identifier_idx" ON "AdminVerification"("identifier");

CREATE TABLE IF NOT EXISTS "AdminPasskey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,
    CONSTRAINT "AdminPasskey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminPasskey_credentialID_key" ON "AdminPasskey"("credentialID");
CREATE INDEX IF NOT EXISTS "AdminPasskey_userId_idx" ON "AdminPasskey"("userId");

CREATE TABLE IF NOT EXISTS "AdminTwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "AdminTwoFactor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminTwoFactor_userId_idx" ON "AdminTwoFactor"("userId");

CREATE TABLE IF NOT EXISTS "AdminEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminEnrollment_tokenHash_key" ON "AdminEnrollment"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminEnrollment_userId_idx" ON "AdminEnrollment"("userId");

CREATE TABLE IF NOT EXISTS "AdminAuthEvent" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "adminUserId" TEXT,
    "email" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuthEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminAuthEvent_seq_key" ON "AdminAuthEvent"("seq");
CREATE INDEX IF NOT EXISTS "AdminAuthEvent_createdAt_idx" ON "AdminAuthEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuthEvent_adminUserId_createdAt_idx" ON "AdminAuthEvent"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuthEvent_action_createdAt_idx" ON "AdminAuthEvent"("action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminSession_userId_fkey') THEN
    ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminAccount_userId_fkey') THEN
    ALTER TABLE "AdminAccount" ADD CONSTRAINT "AdminAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminPasskey_userId_fkey') THEN
    ALTER TABLE "AdminPasskey" ADD CONSTRAINT "AdminPasskey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminTwoFactor_userId_fkey') THEN
    ALTER TABLE "AdminTwoFactor" ADD CONSTRAINT "AdminTwoFactor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminEnrollment_userId_fkey') THEN
    ALTER TABLE "AdminEnrollment" ADD CONSTRAINT "AdminEnrollment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AdminAuthEvent is append-only: no UPDATE ever, DELETE only for rows older than 400 days (retention).
-- No foreign key on adminUserId on purpose: the log must outlive a removed account.
CREATE OR REPLACE FUNCTION "admin_auth_event_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'AdminAuthEvent is append-only (UPDATE refused)';
  END IF;
  IF TG_OP = 'DELETE' AND OLD."createdAt" > (now() - interval '400 days') THEN
    RAISE EXCEPTION 'AdminAuthEvent rows younger than 400 days cannot be deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "admin_auth_event_append_only" ON "AdminAuthEvent";
CREATE TRIGGER "admin_auth_event_append_only"
  BEFORE UPDATE OR DELETE ON "AdminAuthEvent"
  FOR EACH ROW EXECUTE FUNCTION "admin_auth_event_append_only"();

-- TRUNCATE bypasses row triggers, so it gets its own statement trigger.
CREATE OR REPLACE FUNCTION "admin_auth_event_no_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuthEvent cannot be truncated';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "admin_auth_event_no_truncate" ON "AdminAuthEvent";
CREATE TRIGGER "admin_auth_event_no_truncate"
  BEFORE TRUNCATE ON "AdminAuthEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "admin_auth_event_no_truncate"();
