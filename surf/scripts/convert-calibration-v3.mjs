// One-time migration only. Runtime must never import legacy calibration rules.
import fs from "node:fs";
export const baseCalibration = JSON.parse(
  fs.readFileSync(
    new URL("../db/seeds/calibration-default-v3.json", import.meta.url),
  ),
);
export const calibrationSchema = JSON.parse(
  fs.readFileSync(
    new URL("../db/seeds/calibration-schema-v3.json", import.meta.url),
  ),
);
export function convertCalibration(old) {
  const c = structuredClone(baseCalibration);
  for (const key of Object.keys(c))
    if (old[key] !== undefined) c[key] = structuredClone(old[key]);
  const ranges = {
    any: [0, 1],
    "low-mid": [0, 0.6],
    mid: [0.25, 0.75],
    "mid-high": [0.4, 1],
    bafureira: [0.4, 1],
    bico: [0, 0.35],
  };
  if (!ranges[old.tidePreference])
    throw new Error("Unknown legacy tide preference");
  const [low, high] = ranges[old.tidePreference];
  c.tideRules = [{ minimumSwell: 0, low, high }];
  if (old.tidePreference === "bico")
    c.tideRules.push({
      minimumSwell: old.largerSwellThreshold,
      low: 0,
      high: 0.7,
    });
  if (old.northWindShelter !== 1)
    c.windSectors = [{ from: 315, to: 45, gain: old.northWindShelter }];
  return c;
}
