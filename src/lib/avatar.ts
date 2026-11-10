// A drawn avatar: front-facing cartoon bust with a thin brown outline and
// soft volume. Stored on the user as a small object of choices; every value
// is checked against these lists, so the SVG below is only ever built from
// our own strings.

const INK = "#3a2619";
const W = 3;
const S = (w = W) => `stroke="${INK}" stroke-width="${w === W ? W : +(w * 0.65).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"`;

export const SKINS = ["#f6d5b8", "#e3b48d", "#c58c63", "#9a6038", "#6e4122"] as const;
export const HAIR_COLORS = ["#161616", "#3e2412", "#7a4a26", "#d6a648", "#b04a26", "#c9c4bd", "#ef9fbf", "#7b93e8"] as const;
export const CLOTH_COLORS = ["#ffffff", "#2b2b2b", "#2a78d6", "#1baf7a", "#f2c94c", "#e16259", "#f7c6d0", "#8e7cff"] as const;
export const BG_COLORS = ["#2a78d6", "#1baf7a", "#f2c94c", "#e16259", "#f7c6d0", "#eb6834", "#8e7cff", "#d9f39a"] as const;

const FACE = "M50,112 C50,80 72,62 100,62 C128,62 150,80 150,112 C150,142 128,162 100,162 C72,162 50,142 50,112 Z";

// A scalloped outline around a centre, for curly hair.
function cloud(cx: number, cy: number, rx: number, ry: number, n: number, amp: number) {
  const pt = (a: number, k = 1) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  let [x, y] = pt(-Math.PI / 2);
  let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const [qx, qy] = pt(a - Math.PI / n, 1 + amp);
    [x, y] = pt(a);
    d += ` Q${qx.toFixed(1)},${qy.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + " Z";
}
function star(cx: number, cy: number, r1: number, r2: number, n: number, rot = 0) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1);
  }
  return d + "Z";
}

// Hair that sits behind the head.
const braid = (x: number) => Array.from({ length: 6 }, (_, i) => `<ellipse cx="${x}" cy="${128 + i * 15}" rx="11" ry="9" fill="currentColor" ${S()}/>`).join("");
const BACK: Record<string, (c: string) => string> = {
  dosMonos: (c) => `<circle cx="46" cy="140" r="19" fill="${c}" ${S()}/><circle cx="154" cy="140" r="19" fill="${c}" ${S()}/>`,
  coletaAlta: (c) => `<path d="M110,50 C140,36 166,56 164,92 C162,122 156,146 160,176 C163,200 156,222 142,236 C138,212 140,186 136,160 C130,124 140,92 116,68 Z" fill="${c}" ${S()}/>`,
  rizosCortos: (c) => `<path d="${cloud(100, 100, 66, 58, 14, 0.09)}" fill="${c}" ${S()}/>`,
  melena: (c) => `<path d="M44,112 C40,66 66,44 100,44 C134,44 160,66 156,112 L158,162 C150,166 140,166 132,162 L68,162 C60,166 50,166 42,162 Z" fill="${c}" ${S()}/>`,
  afro: (c) => `<path d="${cloud(100, 96, 70, 66, 14, 0.09)}" fill="${c}" ${S()}/>`,
  trenzas: (c) => `<g color="${c}">${braid(42)}${braid(158)}</g>`,
  rizos: (c) => `<path d="${cloud(100, 112, 86, 84, 16, 0.07)}" fill="${c}" ${S()}/>`,
  largo: (c) => `<path d="M44,112 C40,66 66,44 100,44 C134,44 160,66 156,112 L158,188 L146,180 L138,192 L128,180 L118,192 L108,180 L100,188 L92,180 L82,192 L72,180 L62,192 L54,180 L42,188 Z" fill="${c}" ${S()}/>`,
  coletas: (c) => `<path d="${star(36, 82, 34, 15, 6, -0.3)}" fill="${c}" ${S()}/><path d="${star(164, 82, 34, 15, 6, 0.3)}" fill="${c}" ${S()}/>`,
  mono: (c) => `<circle cx="100" cy="38" r="24" fill="${c}" ${S()}/>`,
  media: (c) => `<path d="M46,112 C42,66 66,46 100,46 C134,46 158,66 154,112 C156,132 152,148 144,156 L56,156 C48,148 44,132 46,112 Z" fill="${c}" ${S()}/>`,
};
// The cap of hair over the forehead (ends above the ears): [shape, front edge].
const CAPS: Record<string, [string, string]> = {
  raya: ["M47,100 C46,68 70,48 100,48 C130,48 154,68 153,100 L146,100 C138,90 122,82 100,78 C78,82 62,90 54,100 Z", "M54,100 C62,90 78,82 100,78 C122,82 138,90 146,100"],
  flequillo: [
    "M47,100 C46,68 70,48 100,48 C130,48 154,68 153,100 L146,100 L140,92 L133,99 L125,90 L116,99 L107,90 L98,99 L89,90 L80,98 L71,90 L63,96 L54,100 Z",
    "M146,100 L140,92 L133,99 L125,90 L116,99 L107,90 L98,99 L89,90 L80,98 L71,90 L63,96 L54,100",
  ],
  lado: ["M47,100 C46,68 70,48 104,48 C132,48 154,68 153,100 L146,100 C140,92 128,84 112,80 C92,90 70,96 54,100 Z", "M54,100 C70,96 92,90 112,80 C128,84 140,92 146,100"],
  corto: ["M50,98 C48,70 70,54 100,54 C130,54 152,70 150,98 C142,86 122,80 100,80 C78,80 58,86 50,98 Z", "M50,98 C58,86 78,80 100,80 C122,80 142,86 150,98"],
  tupe: ["M50,98 C48,68 70,48 104,46 C130,44 152,62 150,98 C140,86 122,82 104,84 C84,86 62,88 50,98 Z", "M50,98 C62,88 84,86 104,84 C122,82 140,86 150,98"],
};
// Hairstyle → [what's behind, the cap]. Outlined caps: nothing behind, or a bun.
const HAIR_PARTS: Record<string, [string | null, string | null]> = {
  rizos: ["rizos", "raya"],
  "rizos flequillo": ["rizos", "flequillo"],
  largo: ["largo", "raya"],
  "largo flequillo": ["largo", "flequillo"],
  coletas: ["coletas", "raya"],
  moño: ["mono", "raya"],
  "dos moños": ["dosMonos", "raya"],
  media: ["media", "lado"],
  corto: [null, "corto"],
  rapado: [null, null],
  afro: ["afro", "corto"],
  "rizos cortos": ["rizosCortos", "raya"],
  melena: ["melena", "raya"],
  coleta: ["coletaAlta", "corto"],
  trenzas: ["trenzas", "raya"],
  tupé: [null, "tupe"],
};
const OUTLINED_CAP = new Set(["moño", "dos moños", "coleta"]);
// Long or big hair covers the ears.
const COVERS_EARS = new Set(["rizos", "rizos flequillo", "largo", "largo flequillo", "melena", "media"]);

const EYE: Record<string, () => string> = {
  puntos: () => `<circle r="6.5" fill="${INK}"/>`,
  feliz: () => `<path d="M-12,4 Q0,-10 12,4" fill="none" ${S(5)}/>`,
  guiño: () => "",
  dormida: () => `<path d="M-12,-1 Q0,8 12,-1" fill="none" ${S(5)}/>`,
  grandes: () => `<circle r="12" fill="#fff" ${S(4)}/><circle cx="1" cy="1" r="6" fill="${INK}"/>`,
  estrellas: () => `<path d="${star(0, 0, 10, 4.3, 5, -Math.PI / 2)}" fill="#f2c94c" ${S(3.5)}/>`,
  ko: () => `<path d="M-8,-8 L8,8 M8,-8 L-8,8" ${S(5)}/>`,
};
const BROW: Record<string, (s: number) => string> = {
  arco: (s) => `<path d="M${-14 * s},4 C${-6 * s},-4 ${8 * s},-4 ${15 * s},2" fill="none" ${S(5.5)}/>`,
  rectas: (s) => `<path d="M${-14 * s},0 L${14 * s},-1" fill="none" ${S(7)}/>`,
  sorpresa: (s) => `<path d="M${-13 * s},-4 C${-5 * s},-12 ${7 * s},-12 ${14 * s},-5" fill="none" ${S(5.5)}/>`,
  enfado: (s) => `<path d="M${-14 * s},-6 L${14 * s},5" fill="none" ${S(7)}/>`,
  pena: (s) => `<path d="M${-14 * s},5 L${14 * s},-5" fill="none" ${S(6)}/>`,
};
const LIP = "#5b2d22";
const MOUTH: Record<string, string> = {
  labios: `<path d="M-10,0 C-7,-6 -3,-5 0,-3 C3,-5 7,-6 10,0 C7,8 -7,8 -10,0 Z" fill="${LIP}" ${S(3.5)}/><path d="M-7,0 L7,0" ${S(2.5)}/>`,
  sonrisa: `<path d="M-11,-3 Q0,11 11,-3" fill="none" ${S(5)}/>`,
  risa: `<path d="M-8.5,-5 L8.5,-5 Q8,12 0,13 Q-8,12 -8.5,-5 Z" fill="#fff" ${S(4.5)}/>`,
  carcajada: `<path d="M-8.5,-5 L8.5,-5 Q8.5,11 0,12 Q-8.5,11 -8.5,-5 Z" fill="${INK}" ${S(4.5)}/><path d="M-4,8 Q0,3 4,8 Q0,11 -4,8 Z" fill="#e8737a"/>`,
  lengua: `<path d="M-11,-2 Q0,8 11,-2" fill="none" ${S(5)}/><path d="M-3,4 Q-4,16 4,16 Q11,15 9,3" fill="#e8737a" ${S(3.5)}/>`,
  seria: `<path d="M-9,0 L9,0" ${S(5)}/>`,
  oh: `<ellipse rx="7" ry="9" fill="${INK}"/>`,
  puchero: `<path d="M-10,5 Q0,-6 10,5" fill="none" ${S(5)}/>`,
};
const GLASS: Record<string, string> = {
  ninguna: "",
  pasta: `<rect x="64" y="107" width="31" height="22" rx="7" fill="none" ${S(6)}/><rect x="105" y="107" width="31" height="22" rx="7" fill="none" ${S(6)}/><path d="M95,114 Q100,111 105,114" fill="none" ${S(5)}/>`,
  redondas: `<circle cx="80" cy="118" r="12" fill="none" ${S(4)}/><circle cx="120" cy="118" r="12" fill="none" ${S(4)}/><path d="M92,116 Q100,112 108,116" fill="none" ${S(4)}/>`,
  gatunas: `<path d="M63,108 C72,110 88,108 96,112 C96,124 90,130 80,130 C70,130 64,122 63,108 Z M137,108 C128,110 112,108 104,112 C104,124 110,130 120,130 C130,130 136,122 137,108 Z" fill="none" ${S(6)}/><path d="M96,114 Q100,111 104,114" fill="none" ${S(5)}/>`,
  sol: `<path d="M64,108 L96,108 C96,124 90,131 80,131 C70,131 64,124 64,108 Z M104,108 L136,108 C136,124 130,131 120,131 C110,131 104,124 104,108 Z" fill="${INK}" ${S(5)}/><path d="M96,111 L104,111" ${S(5)}/><path d="M70,113 L76,113 M110,113 L116,113" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
};
const EXTRA: Record<string, string> = {
  nada: "",
  aros: `<circle cx="47" cy="134" r="7" fill="none" stroke="#d8b25a" stroke-width="3.5"/><circle cx="153" cy="134" r="7" fill="none" stroke="#d8b25a" stroke-width="3.5"/>`,
  pecas: "",
  cascos: `<path d="M44,112 C42,62 70,40 100,40 C130,40 158,62 156,112" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M44,112 C42,62 70,40 100,40 C130,40 158,62 156,112" fill="none" stroke="#cfd2d6" stroke-width="7" stroke-linecap="round"/><rect x="30" y="96" width="26" height="40" rx="13" fill="#cfd2d6" ${S()}/><rect x="144" y="96" width="26" height="40" rx="13" fill="#cfd2d6" ${S()}/><path d="M38,104 L38,114 M162,104 L162,114" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  corona: `<path d="M70,62 L72,30 L86,46 L100,22 L114,46 L128,30 L130,62 Z" fill="#f2c94c" ${S()}/><circle cx="100" cy="50" r="4" fill="#e16259"/>`,
};
const FRECKLES = [[74, 128], [80, 132], [70, 133], [126, 128], [120, 132], [130, 133]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#8a4a2a"/>`).join("");

const TORSO = "M10,250 C12,196 48,170 100,170 C152,170 188,196 190,250 Z";
const NECKLINE = `<path d="M80,170 Q100,190 120,170" fill="none" ${S()}/>`;
const OUTFIT: Record<string, (c: string, id: string) => string> = {
  camiseta: (c) => `<path d="${TORSO}" fill="${c}" ${S()}/>${NECKLINE}`,
  camisa: (c) => `<path d="${TORSO}" fill="${c}" ${S()}/><path d="M100,188 L100,250" ${S()}/><path d="M84,170 L100,188 L116,170" fill="none" ${S()}/><circle cx="100" cy="210" r="2.4" fill="${INK}"/><circle cx="100" cy="228" r="2.4" fill="${INK}"/>`,
  sudadera: (c) => `<path d="${TORSO}" fill="${c}" ${S()}/><path d="M66,176 C74,198 126,198 134,176" fill="none" ${S()}/>`,
  rayas: (c, id) => `<clipPath id="t${id}"><path d="${TORSO}"/></clipPath><path d="${TORSO}" fill="#fff"/><g clip-path="url(#t${id})">${[184, 200, 216, 232].map((y) => `<rect x="0" y="${y}" width="200" height="8" fill="${c}"/>`).join("")}</g><path d="${TORSO}" fill="none" ${S()}/>${NECKLINE}`,
  peto: (c) => `<path d="${TORSO}" fill="#fff" ${S()}/>${NECKLINE}<path d="M66,206 L134,206 L136,250 L64,250 Z" fill="${c}" ${S()}/><path d="M70,206 L64,176 M130,206 L136,176" ${S(7)}/><circle cx="72" cy="214" r="3" fill="${INK}"/><circle cx="128" cy="214" r="3" fill="${INK}"/>`,
  traje: (c) => `<path d="${TORSO}" fill="${c}" ${S()}/><path d="M84,170 L100,196 L116,170 Z" fill="#fff" ${S()}/><path d="M96,180 L104,180 L106,214 L100,222 L94,214 Z" fill="#e16259" ${S()}/><path d="M84,170 L76,190 L100,226 M116,170 L124,190 L100,226" fill="none" ${S()}/>`,
  esmoquin: () => `<path d="${TORSO}" fill="#1e1e1e" ${S()}/><path d="M84,170 L100,226 L116,170 Z" fill="#fff" ${S()}/><path d="M88,180 L100,186 L112,180 L112,192 L100,186 L88,192 Z" fill="#1e1e1e" ${S(5)}/><circle cx="100" cy="204" r="2.2" fill="${INK}"/><circle cx="100" cy="214" r="2.2" fill="${INK}"/>`,
};

export const HAIRS = Object.keys(HAIR_PARTS);
export const EYES = Object.keys(EYE);
export const BROWS = Object.keys(BROW);
export const MOUTHS = Object.keys(MOUTH);
export const OUTFITS = Object.keys(OUTFIT);
export const GLASSES = Object.keys(GLASS);
export const EXTRAS = Object.keys(EXTRA);

export type Avatar = {
  skin: number;
  hair: string;
  hairColor: number;
  eyes: string;
  brows: string;
  mouth: string;
  outfit: string;
  cloth: number;
  glasses: string;
  extra: string;
  bg: number;
  star: boolean;
};

export const DEFAULT_AVATAR: Avatar = {
  skin: 2, hair: "rizos", hairColor: 1, eyes: "puntos", brows: "arco", mouth: "sonrisa",
  outfit: "camiseta", cloth: 2, glasses: "ninguna", extra: "nada", bg: 1, star: false,
};

const pick = (xs: readonly string[], v: unknown, d: string) => (typeof v === "string" && xs.includes(v) ? v : d);
const idx = (n: number, v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : d);

// Whatever is stored (or sent) → a valid avatar.
export function parseAvatar(raw: unknown): Avatar {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_AVATAR;
  return {
    skin: idx(SKINS.length, o.skin, d.skin),
    hair: pick(HAIRS, o.hair, d.hair),
    hairColor: idx(HAIR_COLORS.length, o.hairColor, d.hairColor),
    eyes: pick(EYES, o.eyes, d.eyes),
    brows: pick(BROWS, o.brows, d.brows),
    mouth: pick(MOUTHS, o.mouth, d.mouth),
    outfit: pick(OUTFITS, o.outfit, d.outfit),
    cloth: idx(CLOTH_COLORS.length, o.cloth, d.cloth),
    glasses: pick(GLASSES, o.glasses, d.glasses),
    extra: pick(EXTRAS, o.extra, d.extra),
    bg: idx(BG_COLORS.length, o.bg, d.bg),
    star: o.star === true,
  };
}

// The dice: any combination, from a seed (Math.random by default).
export function randomAvatar(rand: () => number = Math.random): Avatar {
  const one = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const n = (len: number) => Math.floor(rand() * len);
  return {
    skin: n(SKINS.length), hair: one(HAIRS), hairColor: n(HAIR_COLORS.length), eyes: one(EYES), brows: one(BROWS),
    mouth: one(MOUTHS), outfit: one(OUTFITS), cloth: n(CLOTH_COLORS.length),
    glasses: rand() < 0.7 ? "ninguna" : one(GLASSES), extra: rand() < 0.5 ? "nada" : one(EXTRAS),
    bg: n(BG_COLORS.length), star: rand() < 0.3,
  };
}

function shade(hex: string, k: number) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return "#" + [f(v >> 16), f((v >> 8) & 255), f(v & 255)].map((c) => c.toString(16).padStart(2, "0")).join("");
}
const gradient = (id: string, c: string, x2: number, y2: number, a: number, b: number) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${shade(c, a)}"/><stop offset="1" stop-color="${shade(c, b)}"/></linearGradient>`;

// The avatar as an SVG string. `uid` keeps gradient ids apart when many are
// on a page; `view` crops it (the editor zooms into the face or the clothes);
// `plain` swaps the background for a neutral one (editor thumbnails).
export function avatarSvg(input: Avatar, uid: string, view = "0 0 200 200", plain = false): string {
  const a = parseAvatar(input);
  const id = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const skin = `url(#sk${id})`, hair = `url(#hr${id})`, cloth = `url(#cl${id})`;
  const [back, cap] = HAIR_PARTS[a.hair];
  const pair = a.eyes === "guiño" ? ["puntos", "feliz"] : [a.eyes, a.eyes];
  const eye = (k: string, x: number) => `<g transform="translate(${x} 118) scale(1.1)">${EYE[k]()}</g>`;
  const outlined = !back || OUTLINED_CAP.has(a.hair);
  const capSvg = cap ? `<path d="${CAPS[cap][0]}" fill="${hair}" ${outlined ? S() : ""}/>${outlined ? "" : `<path d="${CAPS[cap][1]}" fill="none" ${S()}/>`}` : "";
  const ears = COVERS_EARS.has(a.hair) ? "" : `<circle cx="50" cy="118" r="13" fill="${skin}" ${S()}/><circle cx="150" cy="118" r="13" fill="${skin}" ${S()}/><path d="M46,114 Q52,116 50,124 M154,114 Q148,116 150,124" fill="none" ${S(3.5)}/>`;
  const v = /^[\d. -]+$/.test(view) ? view : "0 0 200 200";
  return `<svg viewBox="${v}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gradient(`sk${id}`, SKINS[a.skin], 1, 0.35, 0.14, -0.16)}${gradient(`hr${id}`, HAIR_COLORS[a.hairColor], 0.5, 1, 0.28, -0.22)}${gradient(`cl${id}`, a.outfit === "esmoquin" ? "#1e1e1e" : CLOTH_COLORS[a.cloth], 0, 1, 0.12, -0.22)}${gradient(`bg${id}`, plain ? "#f3ede2" : BG_COLORS[a.bg], 0, 1, 0.1, -0.14)}<radialGradient id="ck${id}"><stop offset="0" stop-color="#ef7f74" stop-opacity=".45"/><stop offset="1" stop-color="#ef7f74" stop-opacity="0"/></radialGradient><clipPath id="c${id}"><circle cx="100" cy="100" r="100"/></clipPath></defs>
<g clip-path="url(#c${id})"><circle cx="100" cy="100" r="100" fill="url(#bg${id})"/>${a.star && !plain ? `<path d="${star(100, 100, 98, 62, 4, -Math.PI / 2)}" fill="#fff" fill-opacity=".55"/>` : ""}
<g transform="translate(100 106) scale(0.86) translate(-100 -100)">
<g transform="translate(0 -14)">${back && back !== "coletaAlta" ? BACK[back](hair) : ""}</g>
<path d="M88,136 L112,136 L112,176 L88,176 Z" fill="${skin}"/><path d="M89,146 L89,174 M111,146 L111,174" ${S()}/>
${OUTFIT[a.outfit](cloth, id)}
<g transform="translate(0 -14)">${back === "coletaAlta" ? BACK.coletaAlta(hair) : ""}${ears}<path d="${FACE}" fill="${skin}" ${S()}/>${capSvg}${a.extra === "pecas" ? FRECKLES : ""}
<ellipse cx="74" cy="132" rx="11" ry="7" fill="url(#ck${id})"/><ellipse cx="126" cy="132" rx="11" ry="7" fill="url(#ck${id})"/>
<g transform="translate(78 102) scale(0.7 1)">${BROW[a.brows](-1)}</g><g transform="translate(122 102) scale(0.7 1)">${BROW[a.brows](1)}</g>
${eye(pair[0], 78)}${eye(pair[1], 122)}<path d="M97,128 Q100,133 103,128" fill="none" ${S(4)}/>
<g transform="translate(100 145) scale(1.18)">${MOUTH[a.mouth]}</g>${GLASS[a.glasses]}${EXTRA[a.extra]}</g></g></g></svg>`;
}

// @handle: 3-20 lowercase letters, digits, dot or underscore.
export const HANDLE = /^[a-z0-9._]{3,20}$/;
export const cleanHandle = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();
