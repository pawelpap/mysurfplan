import test from "node:test";
import assert from "node:assert/strict";
import { bestDayWindow } from "../lib/conditions/day-window.mjs";

const day = "2026-09-17", timezone = "Europe/Lisbon";
const at = (hour) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00+01:00`);
const sun = { sunrise: at(7) + 20 * 60000, sunset: at(20) };
const hour = (h, score = 85) => ({ time: at(h), score, quality: score >= 75 ? "Good" : "Poor", tone: score >= 75 ? "good" : "poor" });

test("a good morning remains visible when noon is poor; clicking can use the labelled start", () => {
  const window = bestDayWindow([hour(8, 89), hour(9, 90), hour(10, 40), hour(11, 20), hour(12, 10)], day, timezone, sun);
  assert.equal(window.label, "08:00–09:00");
  assert.equal(window.start, at(8));
  assert.equal(window.condition.score, 89);
});
test("night peaks, isolated hours, gaps, partial tide assessments and other dates cannot manufacture windows", () => {
  for (const hours of [
    [hour(5), hour(6)], [hour(8)], [hour(8), hour(10)],
    [hour(8), { ...hour(9), score: null }],
    [hour(8), { ...hour(9), provisional: true }],
    [{ ...hour(8), time: at(8) + 86400000 }, { ...hour(9), time: at(9) + 86400000 }],
  ]) assert.equal(bestDayWindow(hours, day, timezone, sun), null);
  assert.equal(bestDayWindow([hour(8), hour(9)], day, timezone, null), null);
  assert.equal(bestDayWindow([hour(8), hour(9)], day, timezone, { alwaysDown: true }), null);
});
test("window colour uses its worst assessment, ties favour two hours then earlier sessions", () => {
  const w = bestDayWindow([hour(8, 80), hour(9, 90), hour(10, 80), hour(12, 80), hour(13, 90), hour(14, 80)], day, timezone, sun);
  assert.equal(w.label, "08:00–10:00");
  assert.equal(w.condition.score, 80);
  assert.equal(bestDayWindow([hour(8, 90), hour(9, 20)], day, timezone, sun).condition.score, 20);
});
test("daylight boundaries and polar daylight are explicit", () => {
  const hours = [hour(7, 99), hour(8, 85), hour(9, 85), hour(20, 99), hour(21, 99)];
  assert.equal(bestDayWindow(hours, day, timezone, sun).label, "08:00–09:00");
  assert.equal(bestDayWindow([hour(5), hour(6)], day, timezone, { alwaysUp: true }).label, "05:00–06:00");
});
test("a window retains the most demanding experience requirement", () => {
  const window = bestDayWindow([{ ...hour(8, 80), level: "Beginner" }, { ...hour(9, 90), level: "Advanced" }], day, timezone, sun);
  assert.equal(window.condition.level, "Advanced");
  assert.equal(window.condition.score, 80);
});
