import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  distanceLabel,
  orderSpots,
  validCoordinates,
} from "../lib/spot-order.mjs";

const SpotLocationContext = createContext(null);

export function SpotLocationProvider({ children }) {
  const [order, setOrder] = useState("nearest");
  const [position, setPosition] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const locate = useCallback(() => {
    started.current = true;
    const id = ++requestId.current;
    setOrder("nearest");
    setPending(true);
    setError("");
    const fail = (reason) => {
      if (!mounted.current || id !== requestId.current) return;
      setPending(false);
      setOrder("alphabetical");
      setError(
        reason?.code === 1
          ? "Location access is blocked. Allow it in your browser to sort by distance."
          : "Location is unavailable. Spots are sorted A–Z. Try Nearest to me again.",
      );
    };
    if (!navigator.geolocation) return fail();
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!mounted.current || id !== requestId.current) return;
          const next = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          if (!validCoordinates(next)) return fail();
          setPosition(next);
          setPending(false);
        },
        fail,
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    } catch (_) {
      fail();
    }
  }, []);

  const initialise = useCallback(() => {
    if (!started.current) locate();
  }, [locate]);

  const alphabetically = useCallback(() => {
    started.current = true;
    requestId.current += 1;
    setOrder("alphabetical");
    setPending(false);
    setError("");
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <SpotLocationContext.Provider
      value={{
        order,
        position,
        pending,
        error,
        initialise,
        locate,
        alphabetically,
      }}
    >
      {children}
    </SpotLocationContext.Provider>
  );
}

export default function SpotSelect({
  spots,
  value,
  onChange,
  valueKey = "id",
  placeholder,
  required = false,
}) {
  const id = useId();
  const {
    order,
    position,
    pending,
    error,
    initialise,
    locate,
    alphabetically,
  } = useContext(SpotLocationContext);
  // Ask automatically when the first spot picker opens, after login.
  // A–Z remains available without location permission. Coordinates stay in memory.
  useEffect(() => initialise(), [initialise]);
  const origin = order === "nearest" ? position : null;
  const sorted = useMemo(() => orderSpots(spots, origin), [spots, origin]);
  return (
    <div className="spot-picker">
      <div className="spot-picker-heading">
        <label htmlFor={id}>Surf spot</label>
        <div className="spot-sort" role="group" aria-label="Sort surf spots">
          <button
            type="button"
            aria-pressed={order === "nearest"}
            onClick={locate}
            disabled={pending}
            title={origin ? "Update your location" : undefined}
          >
            Nearest to me
          </button>
          <button
            type="button"
            aria-pressed={order === "alphabetical"}
            onClick={alphabetically}
          >
            A–Z
          </button>
        </div>
      </div>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        aria-describedby={pending || error ? `${id}-status` : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {sorted.map(({ spot, distance }) => (
          <option key={spot.id} value={spot[valueKey]}>
            {`${spot.name} · ${spot.region}, ${spot.countryCode}${
              distance === null ? "" : ` · ${distanceLabel(distance)}`
            }`}
          </option>
        ))}
      </select>
      {(pending || error) && (
        <p className="spot-location-status" role="status" id={`${id}-status`}>
          {pending ? "Finding your location…" : error}
        </p>
      )}
    </div>
  );
}
