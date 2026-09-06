import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceLabel,
  orderSpots,
  spotDistanceKm,
  validCoordinates,
} from "../lib/spot-order.mjs";

test("spot distance works worldwide, across the date line and at antipodes", () => {
  const point = (latitude, longitude) => ({ latitude, longitude });
  assert.equal(spotDistanceKm(point(0, 0), point(0, 0)), 0);
  assert.ok(
    Math.abs(spotDistanceKm(point(0, 0), point(1, 0)) - 111.195) < 0.001,
  );
  assert.ok(
    Math.abs(spotDistanceKm(point(0, 179), point(0, -179)) - 222.39) < 0.001,
  );
  assert.ok(
    Math.abs(spotDistanceKm(point(0, 0), point(0, 180)) - 20015.114) < 0.001,
  );
  const london = point(51.5074, -0.1278),
    sydney = point(-33.8688, 151.2093);
  assert.ok(Math.abs(spotDistanceKm(london, sydney) - 16993.9) < 1);
  assert.equal(spotDistanceKm(london, sydney), spotDistanceKm(sydney, london));
});

test("distance order preserves the input and keeps missing coordinates last", () => {
  const spots = [
    { id: "far", name: "Alpha", latitude: 5, longitude: 0 },
    { id: "missing", name: "Aardvark", latitude: null, longitude: 0 },
    { id: "near-z", name: "Zulu", latitude: 1, longitude: 0 },
    { id: "near-a", name: "Água", latitude: 1, longitude: 0 },
  ];
  const before = structuredClone(spots);
  assert.deepEqual(
    orderSpots(spots, { latitude: 0, longitude: 0 }).map((x) => x.spot.id),
    ["near-a", "near-z", "far", "missing"],
  );
  assert.deepEqual(spots, before);
  assert.deepEqual(
    orderSpots(spots).map((x) => x.spot.id),
    ["missing", "near-a", "far", "near-z"],
  );
});

test("bad coordinates cannot produce misleading distances", () => {
  for (const p of [
    null,
    {},
    { latitude: null, longitude: 0 },
    { latitude: "38", longitude: -9 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: Infinity },
  ]) {
    assert.equal(validCoordinates(p), false);
    assert.equal(spotDistanceKm({ latitude: 0, longitude: 0 }, p), null);
  }
});

test("distance labels indicate approximation without unnecessary precision", () => {
  assert.equal(distanceLabel(0), "<100 m");
  assert.equal(distanceLabel(0.24), "≈200 m");
  assert.equal(distanceLabel(1.234), "≈1.2 km");
  assert.equal(distanceLabel(1099.8), "≈1,100 km");
  for (const value of [null, NaN, -1]) assert.equal(distanceLabel(value), "");
});
