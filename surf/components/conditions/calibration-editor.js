import { Field, Button } from "../workspace/ui";
function emptyValue(schema) {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object")
    return Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, emptyValue(v)]),
    );
  if (schema.type === "array")
    return Array.from({ length: schema.minItems || 0 }, (_, i) =>
      emptyValue(Array.isArray(schema.items) ? schema.items[i] : schema.items),
    );
  if (schema.type === "number" || schema.type === "integer")
    return schema.minimum ?? 0;
  return "";
}
export default function CalibrationEditor({ schema, value, onChange, label }) {
  if (schema.const !== undefined) return null;
  const title = label || schema.title;
  if (schema.type === "object")
    return (
      <div className="calibration-fields">
        {Object.entries(schema.properties).map(([key, child]) => (
          <CalibrationEditor
            key={key}
            schema={child}
            value={value[key]}
            onChange={(v) => onChange({ ...value, [key]: v })}
          />
        ))}
      </div>
    );
  if (schema.type === "array") {
    const tuple = Array.isArray(schema.items);
    if (tuple)
      return (
        <div className="calibration-pair">
          {schema.items.map((child, i) => (
            <CalibrationEditor
              key={i}
              label={child.title || `Value ${i + 1}`}
              schema={child}
              value={value[i]}
              onChange={(v) => onChange(value.map((x, n) => (n === i ? v : x)))}
            />
          ))}
        </div>
      );
    return (
      <details className="calibration-group">
        <summary>
          {title}
          <span>
            {value.length} {value.length === 1 ? "entry" : "entries"}
          </span>
        </summary>
        <div className="calibration-rows">
          {value.map((row, i) => (
            <div className="calibration-row" key={i}>
              <CalibrationEditor
                schema={schema.items}
                value={row}
                onChange={(v) =>
                  onChange(value.map((x, n) => (n === i ? v : x)))
                }
              />
              <Button
                tone="quiet"
                type="button"
                disabled={value.length <= schema.minItems}
                onClick={() => onChange(value.filter((_, n) => n !== i))}
              >
                Remove entry {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            disabled={value.length >= schema.maxItems}
            onClick={() => onChange([...value, emptyValue(schema.items)])}
          >
            Add entry
          </Button>
        </div>
      </details>
    );
  }
  return (
    <Field label={`${title}${schema.unit ? ` (${schema.unit})` : ""}`}>
      {(id) =>
        schema.enum ? (
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {schema.enum.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={
              ["number", "integer"].includes(schema.type) ? "number" : "text"
            }
            min={schema.minimum}
            max={schema.maximum}
            step={schema.type === "integer" ? 1 : "any"}
            value={value}
            required
            onChange={(e) =>
              onChange(
                schema.type === "string"
                  ? e.target.value
                  : e.target.value === ""
                    ? ""
                    : Number(e.target.value),
              )
            }
          />
        )
      }
    </Field>
  );
}
