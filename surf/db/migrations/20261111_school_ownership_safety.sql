-- Additive ownership retention correction. The original installed migration remains unchanged.
SELECT assert_membership_authority();
CREATE OR REPLACE FUNCTION maintain_school_ownership(environment_arg text)RETURNS TABLE(expired integer,purged integer)LANGUAGE plpgsql AS $$
DECLARE target uuid;amount integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM job_environment WHERE singleton AND environment=environment_arg)THEN RAISE EXCEPTION 'Wrong environment' USING ERRCODE='22023';END IF;
 expired:=0;purged:=0;
 -- School-first maintenance never acquires user locks. Expiry is the terminal event, not the maintenance time.
 -- Repair only linked expired claims whose terminal time was recorded after their final offer expiry; no migration-time backfill.
 FOR target IN SELECT s.id FROM schools s WHERE EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.school_id=s.id AND o.status='pending'AND o.expires_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM school_ownership_claims c WHERE c.school_id=s.id AND c.status='expired'
  AND c.terminal_at>(SELECT max(o.expires_at)FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='expired')
  AND NOT EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='pending'))
 ORDER BY s.id LIMIT 50 FOR UPDATE OF s SKIP LOCKED LOOP
  UPDATE school_ownership_claims c SET status='expired',
   terminal_at=(SELECT max(o.expires_at)FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='pending'AND o.expires_at<=clock_timestamp()),
   updated_at=clock_timestamp(),revision=revision+1 WHERE school_id=target AND status='approved'
   AND id IN(SELECT claim_id FROM school_ownership_offers WHERE school_id=target AND status='pending' AND expires_at<=clock_timestamp());
  UPDATE school_ownership_offers SET status='expired',terminal_at=expires_at WHERE school_id=target AND status='pending'AND expires_at<=clock_timestamp();
  GET DIAGNOSTICS amount=ROW_COUNT;expired:=expired+amount;
  UPDATE school_ownership_claims c SET terminal_at=(SELECT max(o.expires_at)FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='expired')
  WHERE c.id IN(SELECT old.id FROM school_ownership_claims old WHERE old.school_id=target AND old.status='expired'
   AND old.terminal_at>(SELECT max(o.expires_at)FROM school_ownership_offers o WHERE o.claim_id=old.id AND o.status='expired')
   AND NOT EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.claim_id=old.id AND o.status='pending')
   ORDER BY old.terminal_at,old.id LIMIT 100 FOR UPDATE OF old SKIP LOCKED);
  PERFORM ownership_cancel_jobs(target);
 END LOOP;
 UPDATE school_ownership_claims SET statement=NULL,decision_reason=NULL,case_reference=NULL WHERE id IN(SELECT id FROM school_ownership_claims
  WHERE environment=environment_arg AND terminal_at<clock_timestamp()-interval '30 days'AND(statement IS NOT NULL OR decision_reason IS NOT NULL OR case_reference IS NOT NULL)
  ORDER BY terminal_at,id LIMIT 100 FOR UPDATE SKIP LOCKED);
 GET DIAGNOSTICS purged=ROW_COUNT;
 -- Token hashes and email snapshots are operational data, not retained legal evidence.
 UPDATE school_ownership_offers SET token_hash=NULL,recipient_email=NULL WHERE id IN(SELECT id FROM school_ownership_offers WHERE environment=environment_arg
  AND terminal_at<clock_timestamp()-interval '30 days'AND(token_hash IS NOT NULL OR recipient_email IS NOT NULL)ORDER BY terminal_at,id LIMIT 100 FOR UPDATE SKIP LOCKED);
 UPDATE school_ownership_requests r SET fingerprint=NULL WHERE r.fingerprint IS NOT NULL AND r.created_at<clock_timestamp()-interval '30 days'
 AND(EXISTS(SELECT 1 FROM school_ownership_claims c WHERE c.id=r.claim_id AND c.terminal_at<clock_timestamp()-interval '30 days')
 OR EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.id=r.offer_id AND o.terminal_at<clock_timestamp()-interval '30 days'));
 RETURN NEXT;
END $$;
