-- Refactor email templates from locale-specific hardcoded fields to admin-managed HTML templates.
ALTER TABLE "EmailTemplate" ADD COLUMN "slug" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "subject" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "html" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EmailTemplate"
SET
  "slug" = CASE
    WHEN "name" = 'WELCOME' THEN 'welcome-email'
    ELSE lower(replace("name", '_', '-'))
  END,
  "subject" = COALESCE(NULLIF("subjectPl", ''), "subjectEn"),
  "html" = COALESCE(NULLIF("bodyPl", ''), "bodyEn");

ALTER TABLE "EmailTemplate" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "EmailTemplate" ALTER COLUMN "subject" SET NOT NULL;
ALTER TABLE "EmailTemplate" ALTER COLUMN "html" SET NOT NULL;

DROP INDEX "EmailTemplate_name_key";
ALTER TABLE "EmailTemplate" DROP COLUMN "name";
ALTER TABLE "EmailTemplate" DROP COLUMN "subjectPl";
ALTER TABLE "EmailTemplate" DROP COLUMN "bodyPl";
ALTER TABLE "EmailTemplate" DROP COLUMN "subjectEn";
ALTER TABLE "EmailTemplate" DROP COLUMN "bodyEn";

CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");
