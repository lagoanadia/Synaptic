import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The card shown when a link is shared (WhatsApp, X, LinkedIn…): the
// landing's blue sheet, the title, and a few notes tied together.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Google Fonts serves TrueType (what the image renderer reads) to clients
// that don't announce themselves; null keeps the default font if it fails.
async function googleFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}`)).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

const NOTES = [
  { x: 760, y: 120, r: -4, w: 150, h: 190, label: "Estudios", color: "#fbfaf5" },
  { x: 960, y: 70, r: 3, w: 120, h: 120, label: "Planes", color: "#a9d4ff" },
  { x: 990, y: 300, r: -3, w: 150, h: 190, label: "Ideas", color: "#fbfaf5" },
  { x: 770, y: 380, r: 5, w: 120, h: 120, label: "¡ojo!", color: "#ffd84d" },
];

export default async function Image() {
  const [serif, hand] = await Promise.all([googleFont("Fraunces:opsz,wght@144,800"), googleFont("Caveat:wght@600")]);
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "src/app/icon.png"))).toString("base64")}`;
  const fonts = [
    ...(serif ? [{ name: "Serif", data: serif, weight: 800 as const }] : []),
    ...(hand ? [{ name: "Hand", data: hand, weight: 600 as const }] : []),
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          color: "#fff",
          fontFamily: "sans-serif",
          backgroundColor: "#1c6fd1",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), radial-gradient(circle at 35% 30%, #3fa8ff, #1c6fd1 70%)",
          backgroundSize: "40px 40px, 40px 40px, 100% 100%",
        }}
      >
        <svg width="1200" height="630" style={{ position: "absolute", left: 0, top: 0 }}>
          <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round">
            <path d="M890 200 Q 940 160 990 135" />
            <path d="M880 230 Q 960 300 1040 360" />
            <path d="M850 300 Q 840 360 830 420" />
          </g>
        </svg>
        {NOTES.map((n) => (
          <div
            key={n.label}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              width: n.w,
              height: n.h,
              display: "flex",
              padding: "14px 14px",
              backgroundColor: n.color,
              borderRadius: 4,
              transform: `rotate(${n.r}deg)`,
              boxShadow: "12px 16px 18px rgba(10,20,40,.3)",
              color: "#37352f",
              fontSize: 34,
              fontFamily: hand ? "Hand" : "sans-serif",
            }}
          >
            {n.label}
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600, opacity: 0.95 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={44} height={44} alt="" style={{ borderRadius: 10 }} />
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 34, fontSize: 104, lineHeight: 0.95, letterSpacing: -3, fontFamily: serif ? "Serif" : "sans-serif", fontWeight: 800 }}>
            <span>Tu cabeza,</span>
            <span>en orden.</span>
          </div>
          <div style={{ marginTop: 34, fontSize: 28, opacity: 0.85 }}>synapticnotes.app</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
