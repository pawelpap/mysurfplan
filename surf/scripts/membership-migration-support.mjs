import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';

export const migrationId = '20260909_global_memberships';
export const environments = {
  rehearsal: { branch: 'br-falling-cell-b2i32j8w', host: 'ep-holy-breeze-b2bby6tz.c-6.eu-central-1.aws.neon.tech' },
  staging: { branch: 'br-shy-grass-b2hqthrm', host: 'ep-shiny-violet-b2em1q82.c-6.eu-central-1.aws.neon.tech' },
  production: { branch: 'br-sparkling-hat-b2ogsvs0', host: 'ep-soft-smoke-b2v7g8iu.c-6.eu-central-1.aws.neon.tech' },
};

export async function connect(environment) {
  assert(environments[environment], 'Specify rehearsal, staging or production');
  const file = `/private/tmp/mwp-security-${environment}-url`;
  const stat = await fs.stat(file);
  assert.equal(stat.mode & 0o077, 0, 'Connection export must be private (0600)');
  const url = new URL((await fs.readFile(file, 'utf8')).trim());
  assert.equal(url.hostname, environments[environment].host, 'Database endpoint does not match the selected environment');
  assert.equal(url.pathname, '/neondb', 'Unexpected database');
  assert(!url.hostname.includes('-pooler'), 'Use a direct connection for migration');
  url.searchParams.set('sslmode', 'verify-full');
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000, application_name: `mwp-b1-${environment}` });
  await client.connect();
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'neondb');
  return client;
}

export const sourceTables = ['users', 'schools', 'coaches', 'students', 'lessons', 'lesson_coaches', 'bookings', 'auth_sessions', 'surf_spots', 'spot_calibration_history', 'surf_calibration_profiles', 'tide_stations'];
const schoolAdditions = ['workspace_kind', 'workspace_status', 'listing_status', 'owner_membership_id', 'owner_required_status'];

// Return only counts/digests, never row contents, passwords or session tokens.
export async function fingerprint(client) {
  const query = sourceTables.map(table => {
    const ignored = table === 'schools' ? schoolAdditions : [];
    return `SELECT '${table}' AS name, count(*)::int AS count,
      md5(COALESCE(jsonb_agg(row ORDER BY row::text), '[]'::jsonb)::text) AS digest
      FROM (SELECT to_jsonb(t) - ARRAY[${ignored.map(v => `'${v}'`).join(',')}]::text[] AS row FROM ${table} t) AS rows`;
  }).join(' UNION ALL ');
  return (await client.query(query)).rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function report(client) {
  const installed = !!(await client.query("SELECT to_regclass('public.identity_migration_state') AS name")).rows[0].name;
  const data = {
    installed,
    counts: (await fingerprint(client)).map(({ name, count }) => ({ name, count })),
    roles: (await client.query('SELECT role::text, count(*)::int FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY role')).rows,
    explicitLinks: (await client.query(`SELECT 'coaches' AS entity, count(*) FILTER (WHERE user_id IS NOT NULL)::int AS linked,
      count(*) FILTER (WHERE user_id IS NULL)::int AS unclaimed FROM coaches WHERE deleted_at IS NULL
      UNION ALL SELECT 'students', count(*) FILTER (WHERE user_id IS NOT NULL)::int,
      count(*) FILTER (WHERE user_id IS NULL)::int FROM students WHERE deleted_at IS NULL`)).rows,
  };
  if (!installed) return data;
  data.authority = (await client.query('SELECT authority FROM identity_migration_state WHERE singleton')).rows[0]?.authority;
  data.memberships = (await client.query('SELECT origin,status,count(*)::int FROM school_memberships GROUP BY origin,status ORDER BY origin,status')).rows;
  data.platformAssignments = (await client.query('SELECT count(*)::int AS count FROM platform_role_assignments WHERE revoked_at IS NULL')).rows[0].count;
  data.issues = (await client.query('SELECT issue,count(*)::int FROM identity_reconciliation_issues GROUP BY issue ORDER BY issue')).rows;
  data.shadowDifferences = (await client.query(`
    WITH expected AS (
      SELECT id AS user_id, school_id, role::text FROM users
      WHERE role::text IN ('school_admin','coach') AND deleted_at IS NULL
    ), actual AS (
      SELECT m.user_id,m.school_id,r.role FROM school_memberships m JOIN membership_roles r ON r.membership_id=m.id
      WHERE m.origin='legacy_user' AND r.origin='legacy_user' AND m.status='active' AND r.revoked_at IS NULL
    ), differences AS ((SELECT * FROM expected EXCEPT SELECT * FROM actual)
      UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)),
    expected_platform AS (SELECT id AS user_id FROM users WHERE role::text IN ('admin','platform_admin') AND deleted_at IS NULL),
    actual_platform AS (SELECT user_id FROM platform_role_assignments WHERE origin='legacy_user' AND revoked_at IS NULL),
    platform_diff AS ((SELECT * FROM expected_platform EXCEPT SELECT * FROM actual_platform)
      UNION ALL (SELECT * FROM actual_platform EXCEPT SELECT * FROM expected_platform))
    SELECT ((SELECT count(*) FROM differences)+(SELECT count(*) FROM platform_diff))::int AS count
  `)).rows[0].count;
  return data;
}
