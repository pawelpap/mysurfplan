// Capabilities are computed from the server-loaded identity and one explicit school.
export const isPlatformAdmin = (session) =>
  session?.role === "platform_admin" || session?.role === "admin";
export function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function schoolAccess(session, schoolId) {
  const relation = session?.schools?.find((s) => s.id === schoolId);
  const open = relation?.open !== false;
  const roles =
    relation?.status === "active" && open ? relation.roles || [] : [];
  const owner =
    relation?.status === "active" && open && relation.owner === true;
  return {
    viewSchool: isPlatformAdmin(session) || Boolean(relation && open),
    manageSchool:
      open &&
      (isPlatformAdmin(session) || owner || roles.includes("school_admin")),
    teach: open && roles.includes("coach"),
    owner,
  };
}
export function withSchool(session, schoolId) {
  const relation = session.schools?.find((s) => s.id === schoolId);
  const capabilities = schoolAccess(session, schoolId);
  return {
    ...session,
    schoolId,
    schoolSlug: relation?.slug || null,
    capabilities,
    role: isPlatformAdmin(session)
      ? "platform_admin"
      : capabilities.manageSchool
        ? "school_admin"
        : capabilities.teach
          ? "coach"
          : "student",
  };
}
export function permitsSchoolFilter(session, school) {
  if (school === undefined || school === "") return true;
  if (typeof school !== "string") return false;
  if (isPlatformAdmin(session)) return true;
  return (session?.schools || []).some(
    (s) =>
      s.open &&
      (isUuid(school)
        ? s.id.toLowerCase() === school.toLowerCase()
        : s.slug === school),
  );
}
export function instructorSummary(row) {
  return { id: row.id, name: row.name };
}
