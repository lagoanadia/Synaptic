// The "connection" motif: thin node-and-line drawings for empty states.

export function ConnectionMotifIcon({
  size = 64,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <line x1="14" y1="46" x2="32" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="14" y1="46" x2="48" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="32" y1="16" x2="48" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="14" y1="46" x2="26" y2="50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <circle cx="14" cy="46" r="4" fill="currentColor" />
      <circle cx="32" cy="16" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="48" cy="30" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="26" cy="50" r="2.3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

// Hub-and-spoke: one node per content section, sized by note count (max 8).
export function NotesGraph({
  nodes,
  colorClassName = "text-accent",
}: {
  nodes: { label: string; count: number }[];
  colorClassName?: string;
}) {
  if (nodes.length === 0) return null;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 68;
  const visible = nodes.slice(0, 8);
  const overflow = nodes.length - visible.length;
  const points = visible.map((n, i) => {
    const angle = (i / visible.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  return (
    <div className={`flex flex-col items-center gap-1 py-2 ${colorClassName}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {points.map((p) => (
          <line
            key={`line-${p.label}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeWidth="1.3"
            opacity="0.3"
          />
        ))}
        <circle cx={cx} cy={cy} r={5} fill="currentColor" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={3 + Math.min(p.count, 10) * 0.3} fill="currentColor" opacity="0.75" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.75">
              {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
            </text>
          </g>
        ))}
      </svg>
      {overflow > 0 && (
        <span className="text-xs opacity-60">+{overflow} more section{overflow === 1 ? "" : "s"}</span>
      )}
    </div>
  );
}

// Standard empty-state layout: icon, a one-line explanation, and an
// optional call-to-action slot (a link, button, or form) passed as
// children.
export function ConnectionEmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-subtle px-6 py-10 text-center">
      <ConnectionMotifIcon size={56} className="text-ink-faint" />
      <p className="text-sm text-ink-muted">{title}</p>
      {children}
    </div>
  );
}
