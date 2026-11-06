// SVG filters and patterns behind every notebook cover and folder,
// rendered once per page (in the root layout) and referenced by id.
// Notebook textures are turbulence noise posterized into 2–4 colours,
// which reads as marbled / zebra / croc / leopard paper.

const FILTERS: Record<string, { type: "fractalNoise" | "turbulence"; freq: string; oct: number; seed: number; r: string; g: string; b: string }> = {
  marble: { type: "fractalNoise", freq: "0.045", oct: 3, seed: 7, r: "0.08 0.08 0.95 0.95 0.08", g: "0.07 0.07 0.93 0.93 0.07", b: "0.06 0.06 0.9 0.9 0.06" },
  zebra: { type: "fractalNoise", freq: "0.004 0.055", oct: 2, seed: 3, r: "0.93 0.93 0.15 0.93 0.93", g: "0.89 0.89 0.12 0.89 0.89", b: "0.8 0.8 0.1 0.8 0.8" },
  leopard: { type: "fractalNoise", freq: "0.09", oct: 2, seed: 11, r: "0.12 0.45 0.78 0.78 0.78 0.12", g: "0.09 0.3 0.6 0.6 0.6 0.09", b: "0.06 0.16 0.38 0.38 0.38 0.06" },
  croc: { type: "turbulence", freq: "0.07", oct: 2, seed: 5, r: "0.42 0.6 0.72 0.6", g: "0.06 0.1 0.14 0.1", b: "0.1 0.14 0.18 0.14" },
  green: { type: "fractalNoise", freq: "0.05", oct: 3, seed: 21, r: "0.06 0.1 0.62 0.1", g: "0.2 0.3 0.76 0.3", b: "0.15 0.22 0.64 0.22" },
  ocean: { type: "fractalNoise", freq: "0.03 0.09", oct: 3, seed: 13, r: "0.1 0.16 0.55 0.16", g: "0.2 0.3 0.7 0.3", b: "0.38 0.5 0.85 0.5" },
};

export function CoverDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {Object.entries(FILTERS).map(([id, f]) => (
          <filter key={id} id={`nb-${id}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type={f.type} baseFrequency={f.freq} numOctaves={f.oct} seed={f.seed} />
            <feColorMatrix values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues={f.r} />
              <feFuncG type="discrete" tableValues={f.g} />
              <feFuncB type="discrete" tableValues={f.b} />
            </feComponentTransfer>
          </filter>
        ))}
        <pattern id="fp-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          <rect width="14" height="14" fill="#d9a441" />
          <rect width="3" height="14" fill="#b6423a" />
          <rect x="5" width="2" height="14" fill="#2f6e8f" />
          <rect x="9" width="3" height="14" fill="#e8d6a8" />
        </pattern>
        <pattern id="fp-ikat" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="#c9a98a" />
          <path d="M11 1 21 11 11 21 1 11Z" fill="#7a3b2e" />
          <path d="M11 6 16 11 11 16 6 11Z" fill="#e9d9b8" />
          <circle cx="11" cy="11" r="2" fill="#3e5b3a" />
        </pattern>
        <pattern id="fp-gingham" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#f3efe6" />
          <rect width="6" height="12" fill="#8fb1d9" opacity=".55" />
          <rect width="12" height="6" fill="#8fb1d9" opacity=".55" />
        </pattern>
        <pattern id="fp-sage" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#a9b89a" />
          <circle cx="5" cy="5" r="1.2" fill="#e6ebde" />
        </pattern>
        <pattern id="fp-forest" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#56704f" />
          <path d="M0 16 8 0 16 16Z" fill="#3e5b3a" />
          <path d="M8 16 12 8 16 16Z" fill="#7d9474" />
        </pattern>
        <pattern id="fp-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#e8c88f" />
          <circle cx="4" cy="4" r="2.2" fill="#b07d3a" />
          <circle cx="11" cy="11" r="2.2" fill="#b07d3a" />
        </pattern>
        <pattern id="fp-plum" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="#b49bbf" />
          <rect width="4" height="12" fill="#7d5a8c" />
        </pattern>
      </defs>
    </svg>
  );
}
