// Deployment/replay policy only. Runtime forecasts read versioned database data.
export const trialId = "20260917_sao_pedro_gfs_direction_trial";
export const slugs = ["sao-pedro-bico", "sao-pedro-bafureira"];
export const changeNote = "Owner-authorised provisional GFS 0.16° direction calibration, 17 September 2026. Retain the established response through 283°, admit a sheltered 285–300° shoulder, and taper strongly to 310°. This interprets provider bearings without changing them. Based on forecast comparisons and local guidance, not measured accuracy. Staging only; production approval remains withheld.";
export const source = {
  title: "São Pedro GFS direction trial, 17 September 2026",
  url: "https://www.surfline.com/surf-report/s-o-pedro-do-estoril/640b9d679b6fab7dac307b39?view=table",
  accessed: "2026-09-17",
  note: "Owner clarified that the useful 283° reference is Surfline-specific and authorised making an assumption to improve our calibration. Saturday's approximately 15-second swell: Surfline 283°/1.0 m versus GFS secondary 299°/0.54 m at 06:00 WEST. Other forecast dates show different angular gaps. Trial is a local exposure curve, not a universal bearing offset; height disagreement and distinct tide/minimum-swell rules remain.",
};

export function directionTrial(config, slug) {
  if (!slugs.includes(slug)) return structuredClone(config);
  if (config.marineModel !== "ncep_gfswave016")
    throw new Error("Review this calibration before using another marine model");
  const next = structuredClone(config);
  next.exposureByDirection = [
    ...config.exposureByDirection.filter(([direction]) => direction <= 283),
    [285, 0.68],
    [290, 0.68],
    [295, 0.65],
    [300, 0.60],
    [305, 0.40],
    [310, 0.02],
    ...config.exposureByDirection.filter(([direction]) => direction >= 315),
  ];
  return next;
}

export function trialNotes(notes) {
  return notes.split("West and south-west swell preferred.")[0] +
    "West and south-west swell preferred. Provisional GFS 0.16° exposure calibration, 17 September 2026: retain the established response through 283°, allow sheltered 285–300° swell and taper strongly towards 310°. The owner's 283° guidance refers to Surfline and is not a universal GFS cut-off. Raw provider bearings are unchanged. This supersedes earlier direction guidance only; separate tide, size and experience settings remain. Based on local knowledge and forecast comparisons, pending measured beach observations.";
}
