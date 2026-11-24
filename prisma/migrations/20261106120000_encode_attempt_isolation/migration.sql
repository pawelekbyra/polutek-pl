ALTER TABLE "VideoEncodeJob"
ADD COLUMN "attemptId" TEXT;

CREATE FUNCTION reject_legacy_encode_claim_without_attempt_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- A claim must mint a NEW attemptId. Checking only for NULL is not enough: markFailedOrRetry, release and
  -- requeueStale return a job to QUEUED with its previous attemptId still set, so a legacy worker (which never
  -- writes attemptId) could claim it and run under the previous attempt's identity and output prefix.
  IF OLD."status" <> 'RUNNING' AND NEW."status" = 'RUNNING'
     AND (NEW."attemptId" IS NULL OR NEW."attemptId" IS NOT DISTINCT FROM OLD."attemptId") THEN
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
