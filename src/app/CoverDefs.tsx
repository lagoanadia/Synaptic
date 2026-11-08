// SVG filters and patterns behind every notebook cover and folder,
// rendered once per page (in the root layout) and referenced by id.
// Notebook textures are turbulence noise posterized into 2–4 colours,
// which reads as marbled / zebra / croc / leopard paper.

import { COLLECTIONS, mix, type Collection } from "@/lib/covers";

type Noise = { type: "fractalNoise" | "turbulence"; freq: string; oct: number; seed: number; r: string; g: string; b: string; smooth?: boolean; srgb?: boolean };

const FILTERS: Record<string, Noise> = {
  marble: { type: "fractalNoise", freq: "0.045", oct: 3, seed: 7, r: "0.08 0.08 0.95 0.95 0.08", g: "0.07 0.07 0.93 0.93 0.07", b: "0.06 0.06 0.9 0.9 0.06" },
  zebra: { type: "fractalNoise", freq: "0.004 0.055", oct: 2, seed: 3, r: "0.93 0.93 0.15 0.93 0.93", g: "0.89 0.89 0.12 0.89 0.89", b: "0.8 0.8 0.1 0.8 0.8" },
  leopard: { type: "fractalNoise", freq: "0.09", oct: 2, seed: 11, r: "0.12 0.45 0.78 0.78 0.78 0.12", g: "0.09 0.3 0.6 0.6 0.6 0.09", b: "0.06 0.16 0.38 0.38 0.38 0.06" },
  croc: { type: "turbulence", freq: "0.07", oct: 2, seed: 5, r: "0.42 0.6 0.72 0.6", g: "0.06 0.1 0.14 0.1", b: "0.1 0.14 0.18 0.14" },
  green: { type: "fractalNoise", freq: "0.05", oct: 3, seed: 21, r: "0.06 0.1 0.62 0.1", g: "0.2 0.3 0.76 0.3", b: "0.15 0.22 0.64 0.22" },
  ocean: { type: "fractalNoise", freq: "0.03 0.09", oct: 3, seed: 13, r: "0.1 0.16 0.55 0.16", g: "0.2 0.3 0.7 0.3", b: "0.38 0.5 0.85 0.5" },
  // Cream spots on dark brown fur.
  fawn: { type: "fractalNoise", freq: "0.13", oct: 1, seed: 4, r: "0.17 0.17 0.92", g: "0.12 0.12 0.87", b: "0.09 0.09 0.78", srgb: true },
  // Red reptile skin.
  ruby: { type: "turbulence", freq: "0.05", oct: 2, seed: 9, r: "0.5 0.4 0.28 0.4", g: "0.04 0.03 0.02 0.03", b: "0.11 0.08 0.06 0.08", srgb: true },
  // Dark brown croc.
  ebony: { type: "turbulence", freq: "0.08", oct: 2, seed: 2, r: "0.17 0.11 0.07 0.11", g: "0.13 0.08 0.05 0.08", b: "0.11 0.07 0.05 0.07", srgb: true },
  // Ink swirls on beige.
  smoke: { type: "fractalNoise", freq: "0.02", oct: 2, seed: 17, r: "0.86 0.2 0.86 0.22 0.88 0.18 0.86 0.2 0.86", g: "0.82 0.18 0.82 0.2 0.84 0.16 0.82 0.18 0.82", b: "0.74 0.16 0.74 0.18 0.76 0.14 0.74 0.16 0.74", srgb: true },
  // Green agate, like fields from above.
  moss: { type: "fractalNoise", freq: "0.015", oct: 4, seed: 29, r: "0.12 0.25 0.38 0.18 0.45 0.22 0.32", g: "0.18 0.32 0.42 0.25 0.48 0.3 0.38", b: "0.04 0.08 0.1 0.05 0.12 0.06 0.08", srgb: true },
  // A soft red-orange blur.
  ember: { type: "fractalNoise", freq: "0.003 0.04", oct: 2, seed: 31, r: "0.3 0.75 0.95 0.55", g: "0.03 0.12 0.42 0.08", b: "0.1 0.08 0.12 0.12", smooth: true, srgb: true },
};

// Croc noise in a given colour: the colour, then darker steps.
function crocOf(hex: string, seed: number): Noise {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const steps = (v: number) => [1, 0.72, 0.47, 0.72].map((k) => (v * k).toFixed(3)).join(" ");
  return { type: "turbulence", freq: "0.07", oct: 2, seed, r: steps(r), g: steps(g), b: steps(b), srgb: true };
}

// Folder textures that need noise (glossy croc).
const FOLDER_FILTERS: Record<string, Noise> = {
  oxblood: { type: "turbulence", freq: "0.07", oct: 2, seed: 6, r: "0.36 0.26 0.17 0.26", g: "0.05 0.04 0.03 0.04", b: "0.07 0.05 0.04 0.05", srgb: true },
  olivecroc: { type: "turbulence", freq: "0.07", oct: 2, seed: 8, r: "0.37 0.27 0.19 0.27", g: "0.38 0.28 0.2 0.28", b: "0.1 0.08 0.05 0.08", srgb: true },
  ...Object.fromEntries(COLLECTIONS.flatMap((c, i) => [[`${c.id}Croc`, crocOf(c.dark, 40 + i)], [`${c.id}LightCroc`, crocOf(mix(c.light, "#000000", 0.3), 50 + i)]])),
};

// One collection's patterns, after the "Burdeos y oliva" originals.
function CollectionPatterns({ c }: { c: Collection }) {
  const darker = (h: string, t: number) => mix(h, "#000000", t);
  const lighter = (h: string, t: number) => mix(h, "#ffffff", t);
  return (
    <>
      <pattern id={`fp-${c.id}Flower`} width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill={c.dark} />
        {[[4, 4], [22, 10], [10, 24], [30, 30], [28, 20]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill="none" stroke={lighter(c.dark, 0.15)} strokeWidth=".8" />
        ))}
        <Flower x={26} y={9} r={7} petal={c.light} heart={darker(c.light, 0.5)} />
        <Flower x={8} y={27} r={4.5} petal={darker(c.light, 0.12)} heart={darker(c.light, 0.5)} />
      </pattern>
      <pattern id={`fp-${c.id}Stripe`} width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill={darker(c.dark, 0.25)} />
        <rect width="3" height="10" fill={c.light} />
        <rect x="5" width="1" height="10" fill={c.accent} />
        <rect x="8" width="4" height="10" fill={c.dark} />
        <rect x="13" width="1" height="10" fill={lighter(c.light, 0.2)} />
      </pattern>
      <pattern id={`fp-${c.id}Bloom`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill={c.light} />
        <circle cx="12" cy="30" r="14" fill={darker(c.light, 0.2)} opacity=".6" />
        <Flower x={30} y={12} r={8} petal={c.dark} heart={c.accent} />
      </pattern>
      <pattern id={`fp-${c.id}Damask`} width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill={c.mid} />
        <path d="M14 3c5 4 5 9 0 12-5-3-5-8 0-12Z" fill={darker(c.mid, 0.22)} />
        <path d="M14 15c-3 2-6 2-8 0M14 15c3 2 6 2 8 0" fill="none" stroke={darker(c.mid, 0.22)} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="14" cy="21" r="1.6" fill={darker(c.mid, 0.22)} />
        <path d="M0 24c3-2 3-6 0-8M28 24c-3-2-3-6 0-8" fill="none" stroke={darker(c.mid, 0.22)} strokeWidth="1.2" />
      </pattern>
    </>
  );
}

// A five-petal flower centred on (x, y).
function Flower({ x, y, r, petal, heart }: { x: number; y: number; r: number; petal: string; heart: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={x} cy={y - r * 0.9} rx={r * 0.62} ry={r * 0.95} fill={petal} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.32} fill={heart} />
    </g>
  );
}

function NoiseFilter({ id, f }: { id: string; f: Noise }) {
  const kind = f.smooth ? "table" : "discrete";
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters={f.srgb ? "sRGB" : undefined}>
      <feTurbulence type={f.type} baseFrequency={f.freq} numOctaves={f.oct} seed={f.seed} />
      <feColorMatrix values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" />
      <feComponentTransfer>
        <feFuncR type={kind} tableValues={f.r} />
        <feFuncG type={kind} tableValues={f.g} />
        <feFuncB type={kind} tableValues={f.b} />
      </feComponentTransfer>
    </filter>
  );
}

export function CoverDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {Object.entries(FILTERS).map(([id, f]) => (
          <NoiseFilter key={id} id={`nb-${id}`} f={f} />
        ))}
        {Object.entries(FOLDER_FILTERS).map(([id, f]) => (
          <NoiseFilter key={id} id={`ff-${id}`} f={f} />
        ))}
        <NotebookPatterns />
        <FolderPatterns />
        {COLLECTIONS.map((c) => (
          <CollectionPatterns key={c.id} c={c} />
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

function NotebookPatterns() {
  return (
    <>
      <pattern id="nbp-tartan" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#46503f" />
        <rect width="9" height="24" fill="#2a332b" opacity=".7" />
        <rect width="24" height="9" fill="#2a332b" opacity=".6" />
        <rect x="14" width="1.5" height="24" fill="#8e3b2f" />
        <rect y="14" width="24" height="1.5" fill="#8e3b2f" opacity=".85" />
        <rect x="20" width="1" height="24" fill="#b9a77f" opacity=".6" />
        <rect y="20" width="24" height="1" fill="#b9a77f" opacity=".5" />
      </pattern>
      <pattern id="nbp-mosaic" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#3a1520" />
        <rect x=".5" y=".5" width="4" height="4" rx=".6" fill="#7a3d63" />
        <rect x="5.5" y=".5" width="4" height="4" rx=".6" fill="#9a6a3c" />
        <rect x=".5" y="5.5" width="4" height="4" rx=".6" fill="#3f6470" />
        <rect x="5.5" y="5.5" width="4" height="4" rx=".6" fill="#6d2c3f" />
        <rect x="1" y="1" width="1.5" height="1" fill="#fff" opacity=".3" />
        <rect x="6" y="6" width="1.5" height="1" fill="#fff" opacity=".25" />
      </pattern>
      <pattern id="nbp-velvet" width="21" height="10" patternUnits="userSpaceOnUse">
        <rect width="21" height="10" fill="#24302e" />
        <rect width="4" height="10" fill="#1f3d3d" />
        <rect x="4" width="2" height="10" fill="#6b3b2a" />
        <rect x="6" width="3" height="10" fill="#2f5a58" />
        <rect x="9" width="1" height="10" fill="#c9b48a" />
        <rect x="10" width="3" height="10" fill="#3d2a35" />
        <rect x="13" width="2" height="10" fill="#7a8a6a" />
        <rect x="17" width="1" height="10" fill="#8a4a32" />
      </pattern>
      <pattern id="nbp-bordeaux" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#7d1f2c" />
        <rect width="6" height="10" fill="#8f2a37" />
        <rect x="10" width="1" height="10" fill="#5a1520" />
      </pattern>
      <pattern id="nbp-cream" width="12" height="10" patternUnits="userSpaceOnUse">
        <rect width="12" height="10" fill="#f1e3b5" />
        <rect width="5" height="10" fill="#f8efcf" />
        <rect x="8" width=".8" height="10" fill="#e2cf98" />
      </pattern>
      <pattern id="nbp-blossom" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f3ece0" />
        <Flower x={10} y={11} r={6} petal="#3d1830" heart="#a08048" />
        <Flower x={30} y={29} r={7} petal="#4a1d3a" heart="#a08048" />
        <Flower x={33} y={4} r={3.5} petal="#3d1830" heart="#a08048" />
      </pattern>
    </>
  );
}

function FolderPatterns() {
  return (
    <>
      {/* Painted tiles. */}
      <pattern id="fp-azulejo" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#e5dfcf" />
        <rect width="24" height="24" fill="none" stroke="#b5ad96" strokeWidth=".6" />
        {[[0, 0], [24, 0], [0, 24], [24, 24]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="4.5" fill="#7a2a3a" opacity=".75" />
        ))}
        <circle cx="7" cy="12" r="4.5" fill="#7d8a52" />
        <circle cx="17" cy="12" r="4.5" fill="#7d8a52" />
        <circle cx="12" cy="7" r="4.5" fill="#7d8a52" />
        <circle cx="12" cy="17" r="4.5" fill="#7d8a52" />
        <path d="M12 8.5 15.5 12 12 15.5 8.5 12Z" fill="#7a2a3a" />
        <circle cx="12" cy="12" r="1.2" fill="#e5dfcf" />
      </pattern>
      <pattern id="fp-rainbow" width="21" height="10" patternUnits="userSpaceOnUse">
        {["#d6457f", "#f2a33a", "#f5d442", "#5bb36a", "#3f7fd1", "#7c4fc4", "#e85b4a"].map((c, i) => (
          <rect key={c} x={i * 3} width="3" height="10" fill={c} />
        ))}
      </pattern>
      <pattern id="fp-madras" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#f6efe6" />
        <rect width="8" height="24" fill="#e9a0a8" opacity=".55" />
        <rect x="12" width="4" height="24" fill="#8fb7d9" opacity=".5" />
        <rect width="24" height="8" fill="#e9a0a8" opacity=".45" />
        <rect y="12" width="24" height="4" fill="#f2c66d" opacity=".5" />
        <rect x="20" width="1" height="24" fill="#6b8fb5" opacity=".6" />
        <rect y="20" width="24" height="1" fill="#c96a75" opacity=".5" />
      </pattern>
      {/* Gold orchids on plum lace. */}
      <pattern id="fp-orchid" width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill="#4a1b37" />
        {[[4, 4], [22, 10], [10, 24], [30, 30], [28, 20]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill="none" stroke="#6a2d52" strokeWidth=".8" />
        ))}
        <Flower x={26} y={9} r={7} petal="#b59a3a" heart="#5e4a18" />
        <Flower x={8} y={27} r={4.5} petal="#9c8432" heart="#5e4a18" />
      </pattern>
      <pattern id="fp-regency" width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill="#3a1530" />
        <rect width="3" height="10" fill="#7a8a3a" />
        <rect x="5" width="1" height="10" fill="#c9b26a" />
        <rect x="8" width="4" height="10" fill="#5a2048" />
        <rect x="13" width="1" height="10" fill="#9aa24a" />
      </pattern>
      {/* A plum orchid on olive. */}
      <pattern id="fp-olive" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#76762f" />
        <circle cx="12" cy="30" r="14" fill="#5e5f22" opacity=".6" />
        <Flower x={30} y={12} r={8} petal="#4a1b37" heart="#a8923a" />
      </pattern>
      <pattern id="fp-damask" width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill="#6e2438" />
        <path d="M14 3c5 4 5 9 0 12-5-3-5-8 0-12Z" fill="#561a2b" />
        <path d="M14 15c-3 2-6 2-8 0M14 15c3 2 6 2 8 0" fill="none" stroke="#561a2b" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="14" cy="21" r="1.6" fill="#561a2b" />
        <path d="M0 24c3-2 3-6 0-8M28 24c-3-2-3-6 0-8" fill="none" stroke="#561a2b" strokeWidth="1.2" />
      </pattern>
    </>
  );
}
