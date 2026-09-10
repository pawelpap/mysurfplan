// Exact Figma exports and matching Lucide assets live in public/icons.
// A mask lets the existing light/dark semantic colours apply to every glyph.
export default function Icon({ name, className = "", label }) {
  return (
    <span
      className={`app-icon ${className}`}
      style={{ "--icon-url": `url(/icons/${name}.svg)` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    />
  );
}
