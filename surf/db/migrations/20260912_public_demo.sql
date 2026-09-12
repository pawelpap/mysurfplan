-- Apply before the compatible application. Existing accounts keep password login.
ALTER TABLE users ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX uq_users_public_demo ON users (is_demo) WHERE is_demo AND deleted_at IS NULL;
ALTER TABLE users ADD CONSTRAINT chk_demo_student CHECK (NOT is_demo OR (role::text = 'student' AND password_hash IS NULL));

CREATE FUNCTION account_demo_eligible(actor uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id=actor AND u.is_demo
      AND u.deleted_at IS NULL AND u.disabled_at IS NULL
      AND u.role::text='student' AND u.password_hash IS NULL
      AND NOT account_is_platform(u.id)
      AND NOT EXISTS (
        SELECT 1 FROM account_school_access a WHERE a.user_id=u.id
          AND (a.is_owner OR cardinality(a.roles)>0)
      )
  )
$$;

DO $$
DECLARE school uuid; person uuid;
BEGIN
  SELECT id INTO STRICT school FROM schools WHERE slug='demo-surf-school' AND deleted_at IS NULL;
  INSERT INTO users(name,username,email,role,is_demo)
    VALUES('Demo student','demo-student','demo-student@mywaveplan.invalid','student',true)
    RETURNING id INTO person;
  INSERT INTO students(school_id,user_id,name,email)
    VALUES(school,person,'Demo student','demo-student@mywaveplan.invalid');
  IF NOT account_demo_eligible(person) THEN RAISE EXCEPTION 'Demo eligibility check failed'; END IF;
END $$;

COMMENT ON COLUMN users.is_demo IS 'Public, passwordless, read-only student demo. Disable the account to stop access. Never grant staff or platform authority.';
