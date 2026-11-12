ALTER TABLE "VideoEncodeJob"
ADD COLUMN "attemptId" TEXT;

CREATE FUNCTION reject_legacy_encode_claim_without_attempt_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'RUNNING' AND NEW."status" = 'RUNNING' AND NEW."attemptId" IS NULL THEN
    RAISE EXCEPTION 'VideoEncodeJob claim requires attemptId; drain legacy workers before starting new claims'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "VideoEncodeJob_require_attempt_id_on_claim"
BEFORE UPDATE OF "status" ON "VideoEncodeJob"
FOR EACH ROW
EXECUTE FUNCTION reject_legacy_encode_claim_without_attempt_id();
