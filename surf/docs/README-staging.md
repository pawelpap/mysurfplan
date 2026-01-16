# Staging Environment – MyWavePlan

This document explains how we set up staging with **GitHub `staging` branch**, **Vercel (staging project)**, **Neon (staging DB branch)**, and Contentful.

## Topology

- GitHub branches
  - `main` → Production
  - `staging` → Staging

- Vercel projects
  - Production project → Production domain `mywaveplan.com` → uses `main`
  - Staging project → Staging domain `staging.mywaveplan.com` → uses `staging`

- Neon DB
  - Project: (shared with prod)
  - Branches: `main` (prod), `staging` (staging)

- Contentful
  - Same space reused in both (or separate environment later)

---

## 1) Database schema (Neon, staging branch)

1. Open **Neon Console** → select **staging** branch.
2. Open **SQL Editor** and paste the entire file: [`db/schema.sql`](../db/schema.sql)
3. Click **Run**.  
   The script is idempotent; running it again is safe.

### Optional: Seed demo data

Paste after the schema:

```sql
INSERT INTO schools (name)
SELECT 'SurfLab Lisbon'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE slug='surflab-lisbon');

WITH s AS (SELECT id FROM schools WHERE slug='surflab-lisbon' LIMIT 1)
INSERT INTO coaches (school_id, name, email)
SELECT s.id, 'Ana Silva', 'ana@surflab.pt' FROM s
WHERE NOT EXISTS (SELECT 1 FROM coaches WHERE school_id=s.id AND email='ana@surflab.pt');

WITH s AS (SELECT id FROM schools WHERE slug='surflab-lisbon' LIMIT 1)
INSERT INTO coaches (school_id, name, email)
SELECT s.id, 'João Pereira', 'joao@surflab.pt' FROM s
WHERE NOT EXISTS (SELECT 1 FROM coaches WHERE school_id=s.id AND email='joao@surflab.pt');

WITH s AS (SELECT id FROM schools WHERE slug='surflab-lisbon' LIMIT 1)
INSERT INTO students (school_id, name, email)
SELECT s.id, 'Test Student', 'student@example.com' FROM s
WHERE NOT EXISTS (SELECT 1 FROM students WHERE school_id=s.id AND email='student@example.com');

WITH s AS (SELECT id FROM schools WHERE slug='surflab-lisbon' LIMIT 1),
     c AS (SELECT id FROM coaches WHERE name IN ('Ana Silva','João Pereira')),
     new_l AS (
       INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place, capacity)
       SELECT s.id, date_trunc('minute', now() + interval '1 day') + interval '10 hour', 90, 'Beginner', 'Carcavelos', 6
       FROM s
       WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE school_id=s.id AND start_at > now())
       RETURNING id
     )
INSERT INTO lesson_coaches (lesson_id, coach_id)
SELECT nl.id, c.id FROM new_l nl, c
ON CONFLICT (lesson_id, coach_id) DO NOTHING;
