// "Unificar con Drive": the student's Apps Script (lib/driveAgentScript.ts)
// finds class files and does the Drive work; this decides what happens to
// each one. Pure (tested); lib/driveAgent.ts is the database side.

import { DEFAULT_NAMING, placeMaterial, statementWins, type MaterialKind, type NamingConfig } from "./materialName";

// What the student set in Synaptic: names, folders, and per-file fixes.
export type AgentConfig = NamingConfig & {
  // sourceId → a unit or subject the name doesn't say, or "skip it".
  overrides: Record<string, { unit?: number; subject?: string; skip?: boolean }>;
  // Drive file ids the student pasted (Classroom attachments that show up
  // nowhere else).
  extraIds: string[];
  // Folders where "Mis entregas" was already added once (so removing it sticks).
  offered: string[];
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = { ...DEFAULT_NAMING, overrides: {}, extraIds: [], offered: [] };

export function readConfig(raw: unknown): AgentConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<AgentConfig>;
  const strMap = (m: unknown, fallback: Record<string, string>) =>
    m && typeof m === "object" ? Object.fromEntries(Object.entries(m as Record<string, unknown>).filter(([, v]) => typeof v === "string").map(([k, v]) => [k.toUpperCase(), String(v)])) : fallback;
  return {
    aliases: strMap(c.aliases, DEFAULT_NAMING.aliases),
    folders: strMap(c.folders, DEFAULT_NAMING.folders),
    studentNames: Array.isArray(c.studentNames) ? c.studentNames.filter((n): n is string => typeof n === "string" && n.trim().length > 1).map((n) => n.trim()).slice(0, 10) : [],
    overrides: c.overrides && typeof c.overrides === "object" ? (c.overrides as AgentConfig["overrides"]) : {},
    offered: Array.isArray(c.offered) ? c.offered.filter((x): x is string => typeof x === "string").slice(-500) : [],
    extraIds: Array.isArray(c.extraIds) ? c.extraIds.filter((x): x is string => typeof x === "string" && /^[\w-]{20,}$/.test(x)).slice(0, 500) : [],
  };
}

// A Drive link or a bare id → the id.
export function driveId(link: string): string | null {
  const m = /(?:\/d\/|[?&]id=)([\w-]{20,})/.exec(link) ?? /^([\w-]{20,})$/.exec(link.trim());
  return m ? m[1] : null;
}

export type Candidate = { id: string; name: string; mimeType?: string | null; createdAt: Date; course?: string | null; submission?: boolean };
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
    const p = placeMaterial(s.name, { config, courseSubject: o.subject ?? s.course, unit: o.unit ?? null, submission: s.submission });
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

