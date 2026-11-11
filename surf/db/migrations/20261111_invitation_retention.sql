-- B4 retention: retain minimal role evidence, not expired recipient/token records.
ALTER TABLE school_access_events DROP CONSTRAINT school_access_events_invitation_id_fkey;
ALTER TABLE school_access_events ADD CONSTRAINT school_access_events_invitation_id_fkey
 FOREIGN KEY(invitation_id) REFERENCES school_invitations(id) ON DELETE SET NULL;

UPDATE school_access_events e SET details=e.details||jsonb_build_object('roles',i.requested_roles)
FROM school_invitations i WHERE e.invitation_id=i.id AND e.action='invitation_accepted';
CREATE FUNCTION record_invitation_grant_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='invitation_accepted' AND NEW.invitation_id IS NOT NULL THEN
  SELECT NEW.details||jsonb_build_object('roles',i.requested_roles) INTO NEW.details
  FROM school_invitations i WHERE i.id=NEW.invitation_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER school_access_events_invitation_roles BEFORE INSERT ON school_access_events
 FOR EACH ROW EXECUTE FUNCTION record_invitation_grant_roles();

CREATE FUNCTION maintain_staff_invitations(p_environment text)
RETURNS TABLE(expired integer,removed integer) LANGUAGE plpgsql AS $$
DECLARE candidates uuid[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM job_environment WHERE singleton AND environment=p_environment) THEN
  RAISE EXCEPTION 'Invalid invitation maintenance environment' USING ERRCODE='22023';
 END IF;
 UPDATE school_invitations SET status='expired' WHERE id IN (
  SELECT id FROM school_invitations WHERE status='pending' AND expires_at<=now()
  ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED);
 GET DIAGNOSTICS expired=ROW_COUNT;
 SELECT array_agg(id) INTO candidates FROM (
  SELECT id FROM school_invitations WHERE status IN ('accepted','revoked','expired')
   AND COALESCE(accepted_at,revoked_at,expires_at)<now()-interval '30 days'
  ORDER BY COALESCE(accepted_at,revoked_at,expires_at),id LIMIT 100 FOR UPDATE SKIP LOCKED
 ) bounded;
 -- A long worker outage must not leave ciphertext behind after the invitation is removed.
 UPDATE job_outbox SET payload=NULL,
  status=CASE WHEN status IN ('pending','leased') THEN 'expired' ELSE status END,
  lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE id IN(SELECT email_job_id FROM school_invitations WHERE id=ANY(candidates));
 DELETE FROM school_invitations WHERE id=ANY(candidates);
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN NEXT;
END $$;
