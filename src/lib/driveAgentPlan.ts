// "Unificar con Drive": the student's Apps Script (lib/driveAgentScript.ts)
// finds class files and does the Drive work; this decides what happens to
// each one. Pure (tested); lib/driveAgent.ts is the database side.

import { DEFAULT_NAMING, guessSubjectFromCourse, placeMaterial, statementWins, unitFromText, type MaterialKind, type NamingConfig } from "./materialName";
import { pdfMarker, withTitle } from "./text";

// What the student set in Synaptic: names, folders, and per-file fixes.
export type AgentConfig = NamingConfig & {
  // sourceId → a unit or subject the name doesn't say, or "skip it".
  overrides: Record<string, { unit?: number; subject?: string; skip?: boolean }>;
  // Drive file ids the student pasted (Classroom attachments that show up
  // nowhere else).
  extraIds: string[];
  // Folders where "Mis entregas" was already added once (so removing it sticks).
  offered: string[];
  // Phase d: make a page (summary, concepts, questions) for each topic.
  pages: boolean;
  // Phase e: a Classroom course (or class folder) name → subject code; "" =
  // not a subject (ignore its files). Unlisted ones are guessed.
  courses: Record<string, string>;
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = { ...DEFAULT_NAMING, overrides: {}, extraIds: [], offered: [], pages: true, courses: {} };

export function readConfig(raw: unknown): AgentConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<AgentConfig>;
  const strMap = (m: unknown, fallback: Record<string, string>) =>
    m && typeof m === "object" ? Object.fromEntries(Object.entries(m as Record<string, unknown>).filter(([, v]) => typeof v === "string").map(([k, v]) => [k.toUpperCase(), String(v)])) : fallback;
  return {
    aliases: strMap(c.aliases, DEFAULT_NAMING.aliases),
    folders: strMap(c.folders, DEFAULT_NAMING.folders),
    studentNames: Array.isArray(c.studentNames) ? c.studentNames.filter((n): n is string => typeof n === "string" && n.trim().length > 1).map((n) => n.trim()).slice(0, 10) : [],
    overrides: c.overrides && typeof c.overrides === "object" ? (c.overrides as AgentConfig["overrides"]) : {},
    pages: c.pages !== false,
    courses: c.courses && typeof c.courses === "object" ? Object.fromEntries(Object.entries(c.courses as Record<string, unknown>).filter(([, v]) => typeof v === "string").map(([k, v]) => [k.slice(0, 120), String(v)])) : {},
    offered: Array.isArray(c.offered) ? c.offered.filter((x): x is string => typeof x === "string").slice(-500) : [],
    extraIds: Array.isArray(c.extraIds) ? c.extraIds.filter((x): x is string => typeof x === "string" && /^[\w-]{20,}$/.test(x)).slice(0, 500) : [],
  };
}

// A Drive link or a bare id → the id.
export function driveId(link: string): string | null {
  const m = /(?:\/d\/|[?&]id=)([\w-]{20,})/.exec(link) ?? /^([\w-]{20,})$/.exec(link.trim());
  return m ? m[1] : null;
}

// course: the Classroom course or class folder it came from (a name);
// hint: the Classroom post or assignment title ("UD2 · Cuaderno…").
export type Candidate = { id: string; name: string; mimeType?: string | null; createdAt: Date; course?: string | null; hint?: string | null; submission?: boolean };

/** A course name → its subject: what the student set, else a guess. */
export function subjectForCourse(course: string | null | undefined, config: AgentConfig): string | null {
  if (!course) return null;
  if (course in config.courses) return config.courses[course] || null;
  return guessSubjectFromCourse(course, config);
}
export type Target = { kind: MaterialKind; subject: string; folder: string[]; name: string; pdf: boolean; workbook: boolean };
export type SourceState = Candidate & { status: string; target: Target | null; reason?: string | null };

/**
 * Every known source → its target and status. Several sources for one
 * slot (same folder and name): one wins (the workbook for an assignment,
 * else the newest original) and the rest are "skipped". Sources already
 * done stay done; a newer winner replaces them. `approve`: whether new
 * winners are applied without asking.
 */
export function resolve(sources: (Candidate & { status?: string })[], config: AgentConfig, approve: boolean): SourceState[] {
  const out: SourceState[] = sources.map((s) => {
    const o = config.overrides[s.id] ?? {};
    if (o.skip) return { ...s, status: "skipped", target: null, reason: "ignorado" };
    if (s.course && config.courses[s.course] === "") return { ...s, status: "skipped", target: null, reason: "curso ignorado" };
    const p = placeMaterial(s.name, { config, courseSubject: o.subject ?? subjectForCourse(s.course, config), unit: o.unit ?? unitFromText(s.hint), submission: s.submission });
    if (!p.ok) return { ...s, status: "review", target: null, reason: p.reason };
    return { ...s, status: s.status ?? "planned", target: { kind: p.kind, subject: p.subject, folder: p.folder, name: p.name, pdf: p.pdf, workbook: p.parsed.isWorkbook }, reason: null };
  });

  const slots = new Map<string, SourceState[]>();
  for (const s of out) if (s.target) slots.set([...s.target.folder, s.target.name].join("/"), [...(slots.get([...s.target.folder, s.target.name].join("/")) ?? []), s]);
  for (const group of slots.values()) {
    let win: SourceState | null = null;
    for (const s of [...group].sort((a, b) => +a.createdAt - +b.createdAt)) {
      const wins = s.target!.kind === "statement" ? statementWins({ isWorkbook: s.target!.workbook, createdAt: s.createdAt }, win && { isWorkbook: win.target!.workbook, createdAt: win.createdAt }) : !win || s.createdAt > win.createdAt;
      if (wins) win = s;
    }
    for (const s of group) {
      if (s === win) {
        // A failed one waits for "Reintentar"; done and approved stay.
        if (s.status === "skipped" || s.status === "review" || s.status === "planned") s.status = approve ? "approved" : "planned";
      } else if (s.status !== "done") {
        s.status = "skipped";
        s.reason = "hay una versión mejor";
      }
    }
  }
  return out;
}


// ─── phase d: a topic's page ───────────────────────────────────────────

// "AD_UD2_T9_Capa_datos.pdf" → "T9 · Capa datos"
export const topicTitle = (fileName: string) => {
  const m = /_(T\d+|S\d+)_?(.*)\.[a-z0-9]+$/i.exec(fileName);
  return m ? `${m[1]} · ${m[2].replace(/_/g, " ").trim() || m[1]}` : fileName.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
};

export function pageContent(title: string, fileId: string, ai: { summary: string; concepts: { term: string; definition: string }[] }) {
  const body = [
    pdfMarker(`https://drive.google.com/file/d/${fileId}/view`, title.toUpperCase(), ""),
    ai.summary,
    ai.concepts.length ? `## Conceptos clave\n${ai.concepts.map((c) => `- **${c.term.trim()}**: ${c.definition.trim()}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return withTitle(title, body);
}

