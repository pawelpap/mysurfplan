const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

export function validCoordinates(point) {
  return (
    Number.isFinite(point?.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point?.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

// Great-circle distance, independent of any map service or regional spot model.
export function spotDistanceKm(origin, spot) {
  if (!validCoordinates(origin) || !validCoordinates(spot)) return null;
  const radians = Math.PI / 180;
  const latitude = ((spot.latitude - origin.latitude) * radians) / 2;
  const longitude = ((spot.longitude - origin.longitude) * radians) / 2;
  const a =
    Math.sin(latitude) ** 2 +
    Math.cos(origin.latitude * radians) *
      Math.cos(spot.latitude * radians) *
      Math.sin(longitude) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function orderSpots(spots, origin = null) {
  return spots
    .map((spot) => ({ spot, distance: spotDistanceKm(origin, spot) }))
    .sort((a, b) => {
      if (origin) {
        if (a.distance === null && b.distance !== null) return 1;
        if (b.distance === null && a.distance !== null) return -1;
        if (a.distance !== b.distance) return a.distance - b.distance;
      }
      return (
        collator.compare(a.spot.name, b.spot.name) ||
        collator.compare(a.spot.region || "", b.spot.region || "") ||
        collator.compare(a.spot.id || "", b.spot.id || "")
      );
    });
}

export function distanceLabel(km) {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.1) return "<100 m";
  if (km < 1) return `≈${Math.round(km * 10) * 100} m`;
  return `≈${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km)} km`;
}
