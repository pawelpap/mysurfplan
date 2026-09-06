import { useState } from "react";
import {
  Field,
  SelectField,
  PageHeading,
  FormActions,
  request,
  useData,
  Loading,
  Message,
  Button,
} from "../workspace/ui";
import CalibrationEditor from "./calibration-editor";
export default function SpotForm(props) {
  const data = useData(
    "/api/calibration" + (props.spot ? "?spotId=" + props.spot.id : ""),
  );
  if (data.error)
    return (
      <>
        <Message>{data.error}</Message>
        <Button onClick={data.reload}>Try again</Button>
        <Button onClick={props.onCancel}>Back to Conditions</Button>
      </>
    );
  if (data.loading || !data.data?.schema)
    return <Loading label="Loading calibration settings…" />;
  return <SpotEditor {...props} settings={data.data} />;
}
function SpotEditor({ spot, onCancel, onSaved, settings }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [c, setC] = useState(() =>
    structuredClone(spot?.calibration || settings.defaultProfile.configuration),
  );
  const [profile, setProfile] = useState({
    id: spot?.profileId || settings.defaultProfile.id,
    version: spot?.profileVersion || settings.defaultProfile.version,
  });
  const [defaultVersion, setDefaultVersion] = useState(
    settings.defaultProfile.version,
  );
  const [sources, setSources] = useState(spot?.sources || []),
    [notes, setNotes] = useState(spot?.notes || ""),
    [changeNote, setChangeNote] = useState("");
  const [historyVersion, setHistoryVersion] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (data.tideStationId === "auto") delete data.tideStationId;
    for (const key of ["marineLatitude", "marineLongitude"])
      if (data[key] === "") delete data[key];
    try {
      const result = await request("/api/spots", {
        method: spot ? "PUT" : "POST",
        body: JSON.stringify({
          ...data,
          calibration: c,
          sources,
          notes,
          changeNote,
          active: data.active === "on",
          displayOrder: Number(data.displayOrder),
          profileId: profile.id,
          profileVersion: profile.version,
          id: spot?.id,
          version: spot?.version,
        }),
      });
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDefault() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/calibration", {
        method: "PUT",
        body: JSON.stringify({
          calibration: c,
          version: defaultVersion,
          changeNote,
        }),
      });
      setDefaultVersion(result.version);
      setNotice(
        "Default profile saved for future spots. Existing spots retain their own calibration.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const numericFields = Object.fromEntries(
    Object.entries(settings.schema.properties).filter(
      ([, s]) => !["object", "array"].includes(s.type),
    ),
  );
  const groups = Object.entries(settings.schema.properties).filter(([, s]) =>
    ["object", "array"].includes(s.type),
  );
  return (
    <div className="form-screen spot-form-screen">
      <PageHeading
        title={spot ? "Edit surf spot" : "Add surf spot"}
        description="Location, local conditions and calibration."
        back={{ label: "Conditions", onClick: onCancel }}
      />
      <form className="surface padded" onSubmit={submit}>
        <div className="form-grid">
          {["name", "region", "countryCode", "timezone"].map((k) => (
            <Field
              key={k}
              name={k}
              label={
                {
                  name: "Spot name",
                  region: "Region",
                  countryCode: "Country code",
                  timezone: "Time zone",
                }[k]
              }
              defaultValue={
                spot?.[k] ||
                (k === "timezone"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : "")
              }
              required
              maxLength={k === "countryCode" ? 2 : 150}
            />
          ))}
          {["latitude", "longitude"].map((k) => (
            <Field
              key={k}
              name={k}
              label={k === "latitude" ? "Latitude" : "Longitude"}
              defaultValue={spot?.[k]}
              type="number"
              step="any"
              min={k === "latitude" ? -85 : -180}
              max={k === "latitude" ? 85 : 180}
              required
            />
          ))}
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
            name="tideStationId"
            label="Tide reference"
            defaultValue={spot ? spot.tideStationId || "" : "auto"}
            options={[
              { value: "auto", label: "Choose nearest reference" },
              { value: "", label: "No tide reference" },
              ...settings.stations.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Field
            name="displayOrder"
            label="Spot list priority"
            type="number"
            step="1"
            min="-10000"
            max="10000"
            defaultValue={spot?.displayOrder || 0}
            hint="Higher values appear first."
          />
          <label className="spot-active">
            <input
              type="checkbox"
              name="active"
              defaultChecked={spot?.active ?? true}
            />{" "}
            Available for lessons
          </label>
        </div>
        <details className="calibration-group">
          <summary>Ocean sample location</summary>
          <p className="muted-note">
            Leave blank on a new spot to use its location.
          </p>
          <div className="form-grid">
            {["marineLatitude", "marineLongitude"].map((k) => (
              <Field
                key={k}
                name={k}
                label={
                  k === "marineLatitude"
                    ? "Ocean sample latitude"
                    : "Ocean sample longitude"
                }
                type="number"
                step="any"
                defaultValue={spot?.[k]}
              />
            ))}
          </div>
        </details>
        <section className="spot-calibration">
          <h2>Local calibration</h2>
          <p className="muted-note">
            Settings are saved for this spot. Record the observations behind
            each change.
          </p>
          <div className="form-grid">
            <SelectField
              label="Start from a saved profile"
              value=""
              onChange={(e) => {
                const p = settings.profiles.find(
                  (p) => p.id === e.target.value,
                );
                if (p) {
                  setC(structuredClone(p.configuration));
                  setProfile({ id: p.id, version: p.version });
                  setNotice(
                    "Profile loaded. Review the settings before saving.",
                  );
                }
              }}
              options={[
                { value: "", label: "Choose a profile…" },
                ...settings.profiles.map((p) => ({
                  value: p.id,
                  label: `${p.name} · version ${p.version}`,
                })),
              ]}
            />
            {spot && (
              <SelectField
                label="Previous calibration"
                value={historyVersion}
                onChange={(e) => {
                  setHistoryVersion(e.target.value);
                  const h = settings.history.find(
                    (h) => String(h.version) === e.target.value,
                  );
                  if (h?.schema_version === 3) {
                    setC(structuredClone(h.calibration));
                    setSources(h.sources);
                    setNotes(h.notes);
                    setChangeNote(
                      `Restore calibration from version ${h.version}`,
                    );
                    setNotice(
                      "Previous calibration loaded. Save to create a new version.",
                    );
                  }
                }}
                options={[
                  { value: "", label: "Choose a version to restore…" },
                  ...settings.history
                    .filter((h) => h.schema_version === 3)
                    .map((h) => ({
                      value: String(h.version),
                      label: `Version ${h.version} · ${h.change_note || "Calibration update"}`,
                    })),
                ]}
              />
            )}
          </div>
          <details className="calibration-group">
            <summary>Wave, wind and tide parameters</summary>
            <CalibrationEditor
              schema={{ type: "object", properties: numericFields }}
              value={c}
              onChange={setC}
            />
          </details>
          {groups.map(([key, schema]) =>
            schema.type === "array" ? (
              <CalibrationEditor
                key={key}
                schema={schema}
                value={c[key]}
                onChange={(v) => setC({ ...c, [key]: v })}
              />
            ) : (
              <details key={key} className="calibration-group">
                <summary>{schema.title}</summary>
                <CalibrationEditor
                  schema={schema}
                  value={c[key]}
                  onChange={(v) => setC({ ...c, [key]: v })}
                />
              </details>
            ),
          )}
        </section>
        <Field label="Local notes and observations">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
        <details className="calibration-group">
          <summary>
            Supporting sources <span>{sources.length}</span>
          </summary>
          {sources.map((s, i) => (
            <div className="calibration-row" key={i}>
              {["title", "url", "note"].map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      title: "Source title",
                      url: "Web link",
                      note: "Observation",
                    }[k]
                  }
                  value={s[k] || ""}
                  onChange={(e) =>
                    setSources(
                      sources.map((x, n) =>
                        n === i ? { ...x, [k]: e.target.value } : x,
                      ),
                    )
                  }
                  required={k === "title"}
                />
              ))}
              <Button
                type="button"
                tone="quiet"
                onClick={() => setSources(sources.filter((_, n) => n !== i))}
              >
                Remove source
              </Button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() =>
              setSources([...sources, { title: "", url: "", note: "" }])
            }
          >
            Add source
          </Button>
        </details>
        <Field
          label="Reason for this change"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          required
          maxLength={2000}
        />
        {notice && (
          <p role="status" className="muted-note">
            {notice}
          </p>
        )}
        <details className="calibration-group">
          <summary>Default profile for future spots</summary>
          <p className="muted-note">
            Save these settings as the default for newly created spots. Existing
            spots keep their saved settings.
          </p>
          <Button
            type="button"
            disabled={busy || !changeNote}
            onClick={saveDefault}
          >
            Save as new default version
          </Button>
        </details>
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
