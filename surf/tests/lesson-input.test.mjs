import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLesson,
  lessonStatus,
  safeNext,
} from "../lib/lesson-input.mjs";
const valid = {
  startAt: "2026-09-15T10:00:00+01:00",
  durationMin: "90",
  difficulty: "Beginner",
  place: " Carcavelos ",
  spotId: "550e8400-e29b-41d4-a716-446655440000",
  capacity: "6",
};
test("normalises a lesson and preserves the intended instant", () => {
  assert.deepEqual(validateLesson(valid), {
    startAt: "2026-09-15T09:00:00.000Z",
    durationMin: 90,
    difficulty: "Beginner",
    place: "Carcavelos",
    spotId: "550e8400-e29b-41d4-a716-446655440000",
    capacity: 6,
    coachIds: [],
  });
});
test("rejects invalid dates, levels and empty meeting points", () => {
  for (const patch of [
    { startAt: "bad" },
    { difficulty: "Expert" },
    { place: " " },
  ])
    assert.throws(() => validateLesson({ ...valid, ...patch }));
});
test("rejects invalid booking limits and lesson durations", () => {
  for (const capacity of [0, -1, 1.5, 1001, "invalid"])
    assert.throws(() => validateLesson({ ...valid, capacity }));
  for (const durationMin of [0, -1, 14, 721, 90.5])
    assert.throws(() => validateLesson({ ...valid, durationMin }));
  assert.equal(validateLesson({ ...valid, capacity: "" }).capacity, null);
});
test("rejects malformed instructor ids and removes duplicates", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.deepEqual(validateLesson({ ...valid, coachIds: [id, id] }).coachIds, [
    id,
  ]);
  assert.throws(() => validateLesson({ ...valid, coachIds: ["not-an-id"] }));
});
test("past lessons cannot be offered as available, including full past lessons", () => {
  const lesson = {
    startAt: "2026-09-15T09:00:00Z",
    capacity: 6,
    bookedCount: 6,
  };
  assert.equal(
    lessonStatus(lesson, Date.parse("2026-09-15T10:00:00Z")),
    "Past",
  );
  assert.equal(lessonStatus(lesson, Date.parse("2026-09-14")), "Full");
  assert.equal(
    lessonStatus({ ...lesson, capacity: null }, Date.parse("2026-09-14")),
    "Available",
  );
});
test("login return path stays on this site", () => {
  const good = "/?school=surf-school&lesson=123";
  assert.equal(safeNext(good), good);
  for (const bad of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/example.com",
    undefined,
    ["//example.com"],
  ])
    assert.equal(safeNext(bad), "/");
});

test("lessons require a database spot identifier", () => {
  for (const spotId of [null, undefined, "", "Carcavelos"]) {
    assert.throws(() => validateLesson({ ...valid, spotId }));
  }
});
