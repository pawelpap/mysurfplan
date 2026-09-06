import { createTidePredictor } from "@neaps/tide-predictor";
import { round } from "./model.mjs";
export function predictTides(station, start, end, calibration) {
  if (!station?.harmonic_constituents?.length)
    return { tides: [], extremes: [] };
  // TICON amplitudes are metres and phases are Greenwich lag. Zero offset = mean sea level.
  const predictor = createTidePredictor(station.harmonic_constituents);
  const shift = calibration.tideTimeOffsetMin * 60000,
    scale = calibration.tideHeightScale;
  const options = {
    start: new Date(start - shift),
    end: new Date(end - shift),
  };
  const tides = predictor
    .getTimelinePrediction({ ...options, timeFidelity: 1800 })
    .map((p) => ({
      time: p.time.getTime() + shift,
      height: round(p.level * scale, 3),
    }));
  const extremes = predictor.getExtremesPrediction(options).map((p) => ({
    time: p.time.getTime() + shift,
    height: round(p.level * scale, 2),
    type: p.high ? "High" : "Low",
  }));
  return { tides, extremes };
}
