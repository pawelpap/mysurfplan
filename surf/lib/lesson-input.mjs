export const levels = ["Beginner", "Intermediate", "Advanced"];
export const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function validateLesson(input = {}) {
  const startAt = input.startAt || input.startISO;
  const durationMin = Number(input.durationMin ?? 90);
  const capacity =
    input.capacity === "" || input.capacity == null
      ? null
      : Number(input.capacity);
  const place = typeof input.place === "string" ? input.place.trim() : "";
  const coachIds = input.coachIds ?? [];
  if (!isUuid(input.spotId))
    throw new Error("Choose a surf spot from the list.");
  if (!startAt || !Number.isFinite(Date.parse(startAt)))
    throw new Error("Choose a valid lesson date and time.");
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 720)
    throw new Error("Duration must be between 15 and 720 minutes.");
  if (!levels.includes(input.difficulty))
    throw new Error("Choose a valid lesson level.");
  if (!place || place.length > 200)
    throw new Error("Enter a meeting point of up to 200 characters.");
  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)
  )
    throw new Error("Capacity must be between 1 and 1,000 people.");
  if (!Array.isArray(coachIds) || coachIds.some((id) => !isUuid(id)))
    throw new Error("Choose valid instructors.");
  return {
    startAt: new Date(startAt).toISOString(),
    durationMin,
    difficulty: input.difficulty,
    place,
    spotId: input.spotId,
    capacity,
    coachIds: [...new Set(coachIds)],
  };
}

export function lessonStatus(lesson, now = Date.now()) {
  if (new Date(lesson.startAt).getTime() <= now) return "Past";
  if (
    lesson.capacity != null &&
    Number(lesson.bookedCount) >= Number(lesson.capacity)
  )
    return "Full";
  return "Available";
}
export function safeNext(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\x00-\x1f]/.test(value)
    ? value
    : "/";
}
