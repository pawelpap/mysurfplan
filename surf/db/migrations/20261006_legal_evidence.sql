-- Additive B6 schema. No backfill or inferred acceptance. No policy publication.
CREATE TABLE legal_documents (
  document_id text NOT NULL CHECK (document_id IN ('mywaveplan.privacy','mywaveplan.adult-pilot-terms','mywaveplan.school-processing')),
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 80),
  language text NOT NULL CHECK (language IN ('en-GB','pt-PT','es')),
  kind text NOT NULL CHECK (kind IN ('privacy_notice','terms','school_processing')),
  title text NOT NULL,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('published','staging_preview')),
  environment text NOT NULL REFERENCES job_environment(environment),
  effective_at timestamptz NOT NULL,
  reviewed_at timestamptz NOT NULL,
  PRIMARY KEY(document_id,version,language),
  CHECK (status <> 'staging_preview' OR environment='staging'),
  UNIQUE(document_id,version,language,content_hash),
  CHECK ((document_id='mywaveplan.privacy' AND kind='privacy_notice') OR
    (document_id='mywaveplan.adult-pilot-terms' AND kind='terms') OR
    (document_id='mywaveplan.school-processing' AND kind='school_processing')),
  CHECK (content_hash = encode(sha256(convert_to(content,'UTF8')),'hex'))
);
CREATE FUNCTION legal_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published document versions are immutable; publish a new version'; END $$;
CREATE TRIGGER legal_documents_immutable BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION legal_document_immutable();

CREATE TABLE legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  document_id text NOT NULL,
  version text NOT NULL,
  language text NOT NULL,
  content_hash text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('terms','school_processing')),
  school_id uuid REFERENCES schools(id),
  membership_id uuid REFERENCES school_memberships(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(document_id,version,language,content_hash) REFERENCES legal_documents(document_id,version,language,content_hash),
  FOREIGN KEY(school_id,membership_id) REFERENCES school_memberships(school_id,id),
  CHECK ((kind='terms' AND document_id='mywaveplan.adult-pilot-terms' AND school_id IS NULL AND membership_id IS NULL) OR
    (kind='school_processing' AND document_id='mywaveplan.school-processing' AND school_id IS NOT NULL AND membership_id IS NOT NULL))
);
CREATE UNIQUE INDEX legal_personal_acceptance_once ON legal_acceptances(user_id,document_id,version,language) WHERE school_id IS NULL;
CREATE UNIQUE INDEX legal_school_acceptance_once ON legal_acceptances(user_id,document_id,version,language,school_id) WHERE school_id IS NOT NULL;

CREATE TABLE privacy_notice_deliveries (
  user_id uuid NOT NULL REFERENCES users(id),
  document_id text NOT NULL CHECK (document_id='mywaveplan.privacy'),
  version text NOT NULL,
  language text NOT NULL,
  content_hash text NOT NULL,
  channel text NOT NULL CHECK (channel='legal_page'),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,document_id,version,language,channel),
  FOREIGN KEY(document_id,version,language,content_hash) REFERENCES legal_documents(document_id,version,language,content_hash)
);
CREATE TABLE optional_preference_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (purpose IN ('marketing','analytics','advertising','session_recording','public_ranking')),
  selected boolean NOT NULL CHECK (selected=false),
  version text NOT NULL CHECK (version='optional-preferences/1'),
  language text NOT NULL CHECK (language='en-GB'),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX optional_preference_history ON optional_preference_events(user_id,purpose,id DESC);
