-- Support notifications retain no account identifier or personal data.
ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_type_check;
ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_type_check CHECK (type IN (
  'email.delivery_check','email.account_verify','email.account_reset',
  'email.account_created_notice','email.password_changed_notice','email.account_closed_notice'
));

CREATE FUNCTION queue_account_activity_notice(p_id uuid, p_type text, p_hash text, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql STRICT AS $$
BEGIN
  IF (SELECT environment FROM job_environment WHERE singleton) IS DISTINCT FROM 'production'
     OR p_type NOT IN ('email.account_created_notice','email.password_changed_notice','email.account_closed_notice') THEN
    RAISE EXCEPTION 'Invalid account activity notice binding';
  END IF;
  INSERT INTO job_outbox(id,environment,type,idempotency_key,recipient_hash,payload,expires_at)
  VALUES(p_id,'production',p_type,'account-activity:'||p_id,p_hash,p_payload,now()+interval '48 hours');
  RETURN p_id;
END $$;
