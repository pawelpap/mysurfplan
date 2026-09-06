// Deep-water spectral estimates, using significant height for each independent
// swell partition. Universal physical reference values, not spot calibration.
// Method and sources: docs/SWELL_ENERGY_AND_WATER_TEMPERATURE.md.
const density = 1025; // kg/m³, standard seawater reference
const gravity = 9.80665; // m/s², standard gravity
const valid = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
export function swellEnergy(hour) {
  const prefixes = ["swell", "secondarySwell", "tertiarySwell"];
  let heightSquared = 0,
    weightedPeriod = 0,
    complete = true,
    powerComplete = true,
    count = 0;
  for (const prefix of prefixes) {
    const height = hour?.[prefix + "Height"],
      period = hour?.[prefix + "Period"];
    if (!valid(height)) {
      complete = false;
      continue;
    }
    count++;
    heightSquared += height ** 2;
    if (height === 0) continue;
    if (!valid(period) || period === 0) {
      powerComplete = false;
      continue;
    }
    weightedPeriod += height ** 2 * period;
  }
  return {
    // Missing partitions are not treated as zero: the UI calls this partial.
    energyKjM2: count ? (density * gravity * heightSquared) / 16 / 1000 : null,
    powerKwM:
      count && powerComplete
        ? (density * gravity ** 2 * weightedPeriod) / (64 * Math.PI) / 1000
        : null,
    complete: complete && powerComplete,
    componentsAvailable: count,
    method: "deep-water-swell-v1",
  };
}
