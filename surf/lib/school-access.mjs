// Scope checks for the current single-school account model. Memberships come later.
export function isPlatformAdmin(session) {
  return session?.role === 'platform_admin' || session?.role === 'admin';
}

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function permitsSchoolFilter(session, school) {
  if (isPlatformAdmin(session) || school === undefined || school === '') return true;
  if (typeof school !== 'string' || !session?.schoolId) return false;
  return isUuid(school)
    ? school.toLowerCase() === session.schoolId.toLowerCase()
    : school === session.schoolSlug;
}

export function instructorSummary(row) {
  return { id: row.id, name: row.name };
}
