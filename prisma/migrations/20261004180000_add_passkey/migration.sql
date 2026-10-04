-- Passkeys (Better Auth @better-auth/passkey, WebAuthn). Additive and idempotent: safe to re-run.
-- Stores only the public key and metadata; the private key never leaves the user's device.

CREATE TABLE IF NOT EXISTS "Passkey" (
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

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Passkey_credentialID_key" ON "Passkey"("credentialID");
CREATE INDEX IF NOT EXISTS "Passkey_userId_idx" ON "Passkey"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Passkey_userId_fkey') THEN
    ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
