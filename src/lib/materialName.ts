// "Unificar con Drive", phase a: what a class file's name says and where it
// goes. Pure (no Drive, no database), so it can be tested with real names
// and run anywhere: the server, a Worker, or a student's Apps Script.
//
// Target layout (per subject folder):
//   UDx/ASIG_UDx_Tn_Tema.pdf                 topic (theory), always PDF
//   UDx/Entrega/ASIG_UDx_Enunciado.pdf       the teacher's assignment (one)
//   UDx/Entrega/ASIG_UDx_Entrega.pdf         the student's handed-in work
//   UDx/Entrega/Código/ASIG_UDx_Codigo….ext  reference code, kept as is
//   Sesiones/ASIG_Snn_Tema.pdf               numbered sessions (Proyecto)

export type MaterialKind = "topic" | "statement" | "code" | "submission" | "session";

export type NamingConfig = {
  // Code in the file name → the subject's code ("SGE" → "SXE").
  aliases: Record<string, string>;
  // Subject code → its folder name in Drive ("PROY" → "Proyecto").
  folders: Record<string, string>;
  // How the student signs handed-in work ("Nadia", "NadiaLV"): a file
  // with one of these in its name is theirs.
  studentNames: string[];
};

export const DEFAULT_NAMING: NamingConfig = {
  aliases: { AD: "AD", DI: "DI", DIX: "DIX", PMDM: "PMDM", PSP: "PSP", SGE: "SXE", SXE: "SXE", PT: "PROY", PROY: "PROY", AFON: "AFON", IT2: "IT2", ING: "ING" },
  folders: { AD: "AD", DI: "DI", DIX: "DIX", PMDM: "PMDM", PSP: "PSP", SXE: "SXE", PROY: "Proyecto", AFON: "Afondamento", IT2: "Itinerario II", ING: "Inglés" },
  studentNames: [],
};

export type ParsedName = {
  subject: string;
  unit: number | null;
  topic: number | null;
  session: number | null;
  activities: string[]; // ["A3"]
  version: number; // _v3 → 3, none → 1
  ext: string; // ".pptx"
  words: string[]; // the descriptive words, lower case
  title: string; // "Capa_datos"
  isCode: boolean;
  isWorkbook: boolean; // "cuaderno de actividades": always the assignment
};

export type Placement =
  | { ok: true; kind: MaterialKind; subject: string; folder: string[]; name: string; pdf: boolean; parsed: ParsedName }
  // Can't tell where it goes: shown to the student to decide.
  | { ok: false; reason: "no-subject" | "no-unit" | "unknown"; parsed: ParsedName | null };

const CODE_EXT = /^\.(zip|rar|7z|tar|gz|java|kt|js|jsx|ts|tsx|py|sql|cs|cpp|c|h|php|ipynb|sh|gradle)$/i;
const STOP = new Set(["de", "del", "la", "el", "los", "las", "y", "a", "al", "en"]);
// Words that say what kind of file it is, not what it's about.
const NOISE = /^(codigo|entrega|enunciado|chios)$/i;

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
// "📌 AD", "Itinerario II" → "AD", "ITINERARIOII": for matching folder names.
export const normName = (s: string) => plain(s).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Reads a teacher's (or student's) file name. `courseSubject` is the subject
 * of the Classroom course it came from, for names without one
 * ("UD1_T1_ficheros.pptx" in AD's course).
 */
export function parseMaterialName(fileName: string, config: NamingConfig = DEFAULT_NAMING, courseSubject?: string | null): ParsedName | null {
  const em = /\.([A-Za-z0-9]{1,5})$/.exec(fileName);
  const ext = em ? `.${em[1].toLowerCase()}` : "";
  const base = em ? fileName.slice(0, -em[0].length) : fileName;
  const tokens = plain(base)
    .replace(/\(\d+\)/g, " ") // "(1)" from duplicate downloads
    .split(/[-_ .]+/)
    .filter(Boolean);
  if (!tokens.length) return null;

  let subject = config.aliases[tokens[0].toUpperCase()];
  let rest = tokens.slice(1);
  if (!subject) {
    // Glued: "DIUD2AD", "PMDMUD1".
    const codes = Object.keys(config.aliases).sort((a, b) => b.length - a.length).join("|");
    const glued = new RegExp(`^(${codes})(UD\\d+)(.*)$`, "i").exec(tokens[0]);
    if (glued) {
      subject = config.aliases[glued[1].toUpperCase()];
      rest = [glued[2], ...rest];
    } else if (courseSubject && config.aliases[courseSubject.toUpperCase()]) {
      // No subject in the name: the course's.
      subject = config.aliases[courseSubject.toUpperCase()];
      rest = tokens;
    } else return null;
  }

  const r: ParsedName = { subject, unit: null, topic: null, session: null, activities: [], version: 1, ext, words: [], title: "", isCode: false, isWorkbook: false };
  for (const w of rest) {
    let m: RegExpExecArray | null;
    if ((m = /^UD0?(\d+)$/i.exec(w))) r.unit = Number(m[1]);
    else if ((m = /^T0?(\d+)$/i.exec(w)) && r.topic === null) r.topic = Number(m[1]);
    else if ((m = /^S0?(\d+)$/i.exec(w))) r.session = Number(m[1]);
    else if (/^A\d+$/i.test(w)) r.activities.push(w.toUpperCase());
    else if ((m = /^v(\d+)$/i.exec(w))) r.version = Number(m[1]);
    else if (NOISE.test(w) || config.studentNames.some((n) => n.toLowerCase() === w.toLowerCase())) continue;
    else r.words.push(w.toLowerCase());
  }
  while (r.words.length > 1 && STOP.has(r.words[0])) r.words.shift();
  r.title = cap(r.words.join("_"));
  r.isCode = CODE_EXT.test(ext) || r.words.includes("referencia") || /c[oó]digo/i.test(base);
  r.isWorkbook = r.words.includes("cuaderno");
  return r;
}

/** Is this the student's own work (signed with their name)? */
export const isStudentFile = (fileName: string, config: NamingConfig) =>
  config.studentNames.some((n) => new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(plain(fileName)));

/**
 * Where a file goes. `submission`: it's the student's handed-in work (from
 * Classroom's turned-in attachments, or signed with their name). `unit`
 * fills in a unit the name doesn't say ("DIX_A1_Nadia.pdf" → 1).
 */
export function placeMaterial(
  fileName: string,
  opts: { config?: NamingConfig; courseSubject?: string | null; submission?: boolean; unit?: number | null } = {},
): Placement {
  const config = opts.config ?? DEFAULT_NAMING;
  const parsed = parseMaterialName(fileName, config, opts.courseSubject);
  if (!parsed) return { ok: false, reason: "no-subject", parsed: null };
  const s = parsed.subject;
  const folder = config.folders[s] ?? s;
  const unit = parsed.unit ?? opts.unit ?? null;
  const U = unit !== null ? `UD${unit}` : null;
  const join = (...parts: (string | null | false)[]) => parts.filter(Boolean).join("_");

  if (opts.submission || isStudentFile(fileName, config)) {
    if (!U) return { ok: false, reason: "no-unit", parsed };
    return { ok: true, kind: "submission", subject: s, folder: [folder, U, "Entrega"], name: `${join(s, U, "Entrega")}.pdf`, pdf: true, parsed };
  }
  if (parsed.session !== null && !U) {
    const n = String(parsed.session).padStart(2, "0");
    return { ok: true, kind: "session", subject: s, folder: [folder, "Sesiones"], name: `${join(s, `S${n}`, parsed.title)}.pdf`, pdf: true, parsed };
  }
  if (!U) return { ok: false, reason: "no-unit", parsed };
  if (parsed.topic !== null) {
    return { ok: true, kind: "topic", subject: s, folder: [folder, U], name: `${join(s, U, `T${parsed.topic}`, parsed.title)}.pdf`, pdf: true, parsed };
  }
  if (parsed.isCode) {
    return { ok: true, kind: "code", subject: s, folder: [folder, U, "Entrega", "Código"], name: `${join(s, U, "Codigo", parsed.activities.join("_"))}${parsed.ext}`, pdf: false, parsed };
  }
  return { ok: true, kind: "statement", subject: s, folder: [folder, U, "Entrega"], name: `${join(s, U, "Enunciado")}.pdf`, pdf: true, parsed };
}

/**
 * Two candidates for the same assignment slot: does `next` replace `current`?
 * The workbook ("cuaderno de actividades") always wins over anything else;
 * readings and templates never replace an assignment already there;
 * otherwise the newer original wins.
 */
export function statementWins(next: { isWorkbook: boolean; createdAt: Date }, current: { isWorkbook: boolean; createdAt: Date } | null): boolean {
  if (!current) return true;
  if (next.isWorkbook !== current.isWorkbook) return next.isWorkbook;
  if (!next.isWorkbook) return false; // a reading never replaces the assignment
  return next.createdAt > current.createdAt;
}

/** Same slot, topics or code: the newer original wins (versions, PDF vs PPTX). */
export const newerWins = (next: Date, current: Date | null) => !current || next > current;
