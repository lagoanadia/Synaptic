import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The card shown when a link is shared (WhatsApp, X, LinkedIn…): the
// synapse logo on its own blue.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "src/app/icon.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 64, padding: "0 90px", background: "#26a4ff", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={300} height={300} alt="" style={{ borderRadius: 64, boxShadow: "0 30px 60px rgba(0,40,90,0.25)" }} />
        <div style={{ display: "flex", flexDirection: "column", color: "#fff", maxWidth: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>{SITE_NAME}</div>
          <div style={{ marginTop: 24, fontSize: 40, lineHeight: 1.25, opacity: 0.95 }}>{SITE_TAGLINE}</div>
          <div style={{ marginTop: 36, fontSize: 28, opacity: 0.8 }}>synapticnotes.app</div>
        </div>
      </div>
    ),
    size,
  );
}
