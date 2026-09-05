import { useState } from "react";
import {
  Field,
  SelectField,
  PageHeading,
  FormActions,
  request,
} from "../workspace/ui";
import { defaultCalibration } from "../../lib/conditions/model.mjs";
export default function SpotForm({ spot, onCancel, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const c = spot?.calibration || defaultCalibration;
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/spots", {
        method: spot ? "PUT" : "POST",
        body: JSON.stringify({ ...data, id: spot?.id, version: spot?.version }),
      });
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={spot ? "Edit surf spot" : "Add surf spot"}
        description="Spots are shared across schools. Use a separate record for each break with different conditions."
        back={{ label: "Conditions", onClick: onCancel }}
      />
      <form className="surface padded" onSubmit={submit}>
        <div className="form-grid">
          <Field
            name="name"
            label="Spot name"
            defaultValue={spot?.name || ""}
            maxLength={150}
            required
          />
          <Field
            name="region"
            label="Region"
            defaultValue={spot?.region || ""}
            maxLength={150}
            required
          />
          <Field
            name="countryCode"
            label="Country code"
            placeholder="PT, AU, US…"
            defaultValue={spot?.countryCode || ""}
            pattern="[A-Za-z]{2}"
            maxLength={2}
            required
          />
          <Field
            name="timezone"
            label="Time zone"
            placeholder="e.g. Europe/Lisbon"
            defaultValue={
              spot?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            required
            hint="IANA time zone. Forecast dates follow the spot’s local time."
          />
          <Field
            name="latitude"
            label="Latitude"
            type="number"
            step="any"
            min="-85"
            max="85"
            defaultValue={spot?.latitude}
            required
          />
          <Field
            name="longitude"
            label="Longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            defaultValue={spot?.longitude}
            required
          />
          <Field
            name="shoreNormal"
            label="Direction facing the sea (°)"
            type="number"
            min="0"
            max="359"
            step="1"
            defaultValue={c.shoreNormal}
            required
            hint="From land towards open water: north 0°, east 90°, south 180°, west 270°."
          />
          <SelectField
            name="breakType"
            label="Break type"
            defaultValue={spot?.breakType || "Beach"}
            options={["Beach", "Mixed", "Reef", "Point / reef"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
          <SelectField
            name="minimumLevel"
            label="Minimum experience for the break"
            defaultValue={c.minimumLevel}
            options={["Beginner", "Intermediate", "Advanced"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
          <SelectField
            name="tidePreference"
            label="Preferred tide"
            defaultValue={c.tidePreference}
            options={[
              ["any", "Any stage"],
              ["low-mid", "Low to mid"],
              ["mid", "Mid"],
              ["mid-high", "Mid to high"],
              ["bico", "Bico: low; mid with bigger swell"],
              ["bafureira", "Bafureira: mid-high with higher swell"],
            ].map(([value, label]) => ({ value, label }))}
          />
        </div>
        <details className="spot-calibration">
          <summary>Local calibration</summary>
          <p className="muted-note">
            Initial adjustments, not measured wave transformations. Record the
            observations behind any changes. Previous versions are retained.
          </p>
          <div className="form-grid">
            <Field
              name="swellGain"
              label="Swell height multiplier"
              type="number"
              min=".1"
              max="3"
              step=".01"
              defaultValue={c.swellGain}
              required
              hint="1 leaves exposed swell unchanged before period and directional adjustments."
            />
            <Field
              name="windExposure"
              label="Wind speed multiplier"
              type="number"
              min=".2"
              max="2"
              step=".05"
              defaultValue={c.windExposure}
              required
            />
            <Field
              name="largerSwellThreshold"
              label="Bigger swell threshold (m offshore)"
              type="number"
              min=".1"
              max="6"
              step=".1"
              defaultValue={c.largerSwellThreshold}
              required
            />
            <Field
              name="minimumSwell"
              label="Preferred minimum swell (m offshore)"
              type="number"
              min="0"
              max="6"
              step=".1"
              defaultValue={c.minimumSwell}
              required
            />
            <Field
              name="tideTimeOffsetMin"
              label="Tide time adjustment (minutes)"
              type="number"
              min="-120"
              max="120"
              step="1"
              defaultValue={c.tideTimeOffsetMin}
              required
              hint="Leave at 0 without a verified local offset."
            />
            <Field
              name="tideHeightScale"
              label="Tide range multiplier"
              type="number"
              min=".5"
              max="1.5"
              step=".01"
              defaultValue={c.tideHeightScale}
              required
            />
          </div>
        </details>
        <Field label="Local notes and observations">
          {(id) => (
            <textarea
              id={id}
              name="notes"
              rows={4}
              maxLength={2000}
              defaultValue={spot?.notes || ""}
            />
          )}
        </Field>
        <p className="muted-note">
          A nearby open-licensed tide gauge is selected automatically where
          available, within 50 km. This is a regional reference and should be
          checked locally.
        </p>
        <FormActions
          busy={busy}
          error={error}
          onCancel={onCancel}
          label={spot ? "Save spot" : "Add spot"}
        />
      </form>
    </div>
  );
}
