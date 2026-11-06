-- An upheld appeal may reverse only the exact moderation decision still attached to the resource.
-- Scalar ids intentionally have no FK: moderation decisions are append-only history and may outlive a target.
ALTER TABLE "Creator"
  ADD COLUMN "statusDecisionId" TEXT;

ALTER TABLE "Video"
  ADD COLUMN "moderationDecisionId" TEXT;

-- Preserve reversibility for a still-current legacy moderation decision. A newer lifecycle or upheld-appeal
-- event wins, including an ABA transition back to the same enum value.
WITH latest AS (
  SELECT DISTINCT ON (a."targetId") a."targetId", a."action", a."metadata"
  FROM "AuditLog" a
  WHERE a."targetType" = 'Creator'
    AND a."action" IN ('CHANNEL_STATUS_CHANGED', 'CHANNEL_DELETION_REQUESTED', 'CHANNEL_RESTORED')
  ORDER BY a."targetId", a."createdAt" DESC, a."id" DESC
)
UPDATE "Creator" c
SET "statusDecisionId" = CASE
  WHEN latest."action" = 'CHANNEL_STATUS_CHANGED'
    AND latest."metadata"->'after'->>'status' = c."status"::text
  THEN latest."metadata"->>'decisionId'
  ELSE NULL
END
FROM latest
WHERE c."id" = latest."targetId";

WITH changes AS (
  SELECT a."targetId" AS "videoId", a."createdAt", a."id" AS "auditId",
         a."metadata"->>'decisionId' AS "decisionId", a."metadata"->'after'->>'moderationStatus' AS "status"
  FROM "AuditLog" a
  WHERE a."targetType" = 'Video' AND a."action" = 'VIDEO_MODERATION_CHANGED'
  UNION ALL
  SELECT d."targetId", a."createdAt", a."id", a."metadata"->>'decisionId', a."metadata"->'after'->>'moderationStatus'
  FROM "AuditLog" a
  JOIN "ModerationDecision" d ON d."id" = a."metadata"->>'decisionId'
  WHERE a."targetType" = 'ContentReport' AND a."action" = 'CONTENT_REPORT_RESOLVED'
    AND a."metadata"->>'takedown' = 'true'
  UNION ALL
  SELECT d."targetId", a."createdAt", a."id", NULL::text, NULL::text
  FROM "AuditLog" a
  JOIN "ModerationDecision" d ON d."id" = a."metadata"->>'decisionId'
  WHERE a."targetType" = 'ModerationAppeal' AND a."action" = 'MODERATION_APPEAL_RESOLVED'
    AND a."metadata"->>'reverted' = 'true'
), latest AS (
  SELECT DISTINCT ON (changes."videoId") changes."videoId", changes."decisionId", changes."status"
  FROM changes
  ORDER BY changes."videoId", changes."createdAt" DESC, changes."auditId" DESC
)
UPDATE "Video" v
SET "moderationDecisionId" = CASE
  WHEN latest."status" = v."moderationStatus"::text THEN latest."decisionId"
  ELSE NULL
END
FROM latest
WHERE v."id" = latest."videoId";
