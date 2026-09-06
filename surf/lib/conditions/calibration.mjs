// Schema and calibration values come from PostgreSQL. This module validates
// their structure and evaluates generic curves; it contains no spot defaults.
export const engineVersion = "database-surf-v3";
export function validateAgainstSchema(value, schema, path = "Calibration") {
  const fail = (reason) => {
    throw new Error(`${path}: ${reason}`);
  };
  if (!schema) fail("schema is unavailable");
  if (schema.const !== undefined && value !== schema.const)
    fail("unsupported version");
  if (schema.enum && !schema.enum.includes(value))
    fail("choose a supported value");
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail("must be an object");
    for (const key of schema.required || [])
      if (!(key in value)) fail(`${key} is required`);
    for (const [key, child] of Object.entries(value)) {
      if (!schema.properties?.[key]) fail(`unknown setting ${key}`);
      validateAgainstSchema(child, schema.properties[key], `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) fail("must be a list");
    if (
      value.length < (schema.minItems ?? 0) ||
      value.length > (schema.maxItems ?? Infinity)
    )
      fail("invalid number of entries");
    value.forEach((v, i) =>
      validateAgainstSchema(
        v,
        Array.isArray(schema.items) ? schema.items[i] : schema.items,
        `${path}[${i + 1}]`,
      ),
    );
  } else if (schema.type === "number" || schema.type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (schema.type === "integer" && !Number.isInteger(value))
    )
      fail("must be a finite number");
    if (value < schema.minimum || value > schema.maximum)
      fail(`must be between ${schema.minimum} and ${schema.maximum}`);
  } else if (schema.type === "string" && typeof value !== "string")
    fail("must be text");
  return value;
}
export function validateCalibration(c, schema) {
  validateAgainstSchema(c, schema);
  const fail = (message) => {
    throw new Error(`Calibration: ${message}`);
  };
  for (const key of [
    "exposureByDirection",
    "windDirectionCurve",
    "heightFitCurve",
    "periodFitCurve",
    "sizeCeilingCurve",
  ]) {
    const curve = c[key];
    if (!curve.length && key === "exposureByDirection") continue;
    if (
      curve.length < 2 ||
      curve[0][0] !== 0 ||
      curve.some((p, i) => i && p[0] <= curve[i - 1][0])
    )
      fail(`${key} must start at zero and use increasing inputs`);
    if (
      ["exposureByDirection", "windDirectionCurve"].includes(key) &&
      (curve.at(-1)[0] !== 360 || curve[0][1] !== curve.at(-1)[1])
    )
      fail(`${key} must cover 0–360° with matching values at north`);
  }
  if (
    c.tideRules[0].minimumSwell !== 0 ||
    c.tideRules.some(
      (r, i) =>
        r.low > r.high ||
        (i && r.minimumSwell <= c.tideRules[i - 1].minimumSwell),
    )
  )
    fail(
      "tide rules must start at zero, increase by swell height and have low ≤ high",
    );
  if (
    Math.abs(Object.values(c.weights).reduce((a, b) => a + b, 0) - 1) > 1e-9 ||
    c.weights.tide === 1
  )
    fail("weights must total 1 and include wave or wind suitability");
  if (
    c.periodFactorMin > c.periodFactorMax ||
    c.windFit.offshoreAngleBelow >= c.windFit.onshoreAngleAbove ||
    c.tideDisplay.lowAtMost >= c.tideDisplay.highAtLeast
  )
    fail("lower limits must be below upper limits");
  if (
    c.qualityBands.at(-1).minimumScore !== 0 ||
    c.qualityBands.some(
      (b, i) => i && b.minimumScore >= c.qualityBands[i - 1].minimumScore,
    )
  )
    fail("quality bands must descend to a zero-score band");
  if (c.experienceRules.at(-1).level !== "Advanced")
    fail("experience rules must end with Advanced");
  const ranks = { Beginner: 1, Intermediate: 2, Advanced: 3 };
  if (
    c.experienceRules.some(
      (r, i) =>
        i &&
        (ranks[r.level] <= ranks[c.experienceRules[i - 1].level] ||
          r.maxSurf < c.experienceRules[i - 1].maxSurf ||
          r.maxWind < c.experienceRules[i - 1].maxWind ||
          r.maxPeriod < c.experienceRules[i - 1].maxPeriod),
    )
  )
    fail("experience rules must increase in level and limits");
  return c;
}
export function curveValue(value, points) {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (value <= points[i][0]) {
      const [x, y] = points[i - 1],
        [xx, yy] = points[i];
      return y + ((yy - y) * (value - x)) / (xx - x);
    }
  }
  return points.at(-1)[1];
}
