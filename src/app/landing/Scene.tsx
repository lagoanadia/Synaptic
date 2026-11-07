import type { CSSProperties, ReactNode } from "react";

// Things lying on the blue sheet, seen from above. Sizes and positions are
// in "design pixels" of the stage they sit on (k = one design pixel), so a
// whole scene scales with its stage: see .lnd-stage in globals.css.
export const k = (n: number) => `calc(var(--k) * ${n})`;

type Kind = "paper" | "sticky" | "pink" | "note" | "notebook" | "coffee" | "pencil" | "phone";

export function Thing({
  kind,
  x,
  y,
  r = 0,
  children,
  className = "",
  style,
  depth,
}: {
  kind: Kind;
  x: number;
  y: number;
  r?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  // How far it drifts with the cursor (hero only).
  depth?: number;
}) {
  return (
    <div data-depth={depth} className={`lnd-obj lnd-${kind} ${className}`} style={{ left: k(x), top: k(y), transform: `rotate(${r}deg)`, ...style }}>
      {children && <span className="lnd-hand">{children}</span>}
    </div>
  );
}

// A stage: a box with a fixed design width; everything inside scales with it.
export function Stage({ width, height, className = "", children }: { width: number; height: number; className?: string; children: ReactNode }) {
  return (
    <div className={`lnd-stage ${className}`} style={{ aspectRatio: `${width} / ${height}`, ["--w" as string]: width }}>
      <div className="lnd-stage-inner">{children}</div>
    </div>
  );
}
