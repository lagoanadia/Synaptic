import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The card shown when a link is shared (WhatsApp, X, LinkedIn…).
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A few linked dots, like a concept map.
const DOTS = [
  { x: 930, y: 170, r: 26, fill: "#2383e2" },
  { x: 1060, y: 280, r: 18, fill: "#ffffff" },
  { x: 880, y: 360, r: 20, fill: "#b5502e" },
  { x: 1010, y: 450, r: 14, fill: "#ffffff" },
  { x: 800, y: 230, r: 12, fill: "#ffffff" },
];
const LINKS = [
  [0, 1],
  [0, 2],
  [2, 3],
  [0, 4],
  [1, 3],
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fbfbfa", padding: 80, position: "relative", fontFamily: "sans-serif" }}>
        <svg width="1200" height="630" style={{ position: "absolute", left: 0, top: 0 }}>
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={DOTS[a].x} y1={DOTS[a].y} x2={DOTS[b].x} y2={DOTS[b].y} stroke="#d8d3c9" strokeWidth={3} />
          ))}
          {DOTS.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.fill} stroke={d.fill === "#ffffff" ? "#2383e2" : d.fill} strokeWidth={4} />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: "#2383e2", color: "#fff", fontSize: 44, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: "#0d0d0d" }}>{SITE_NAME}</div>
          </div>
          <div style={{ marginTop: 40, fontSize: 46, lineHeight: 1.2, fontWeight: 700, color: "#37352f" }}>{SITE_TAGLINE}</div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#787774" }}>synapticnotes.app</div>
        </div>
      </div>
    ),
    size,
  );
}
