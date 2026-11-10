// The welcome flow's answers → the notebooks and folders to create. Pure,
// so the browser can preview "Tu espacio" with it and it's unit-tested.

import { NOTEBOOK_COVERS, type NotebookCover } from "@/lib/covers";

// What you do: each one becomes a notebook with the same name.
export const ROLES = [
  { key: "study", label: "Estudios" },
  { key: "projects", label: "Proyectos" },
  { key: "personal", label: "Personal" },
] as const;
export type Role = (typeof ROLES)[number]["key"];

export type OnboardingAnswers = {
  roles: Role[];
  subjects: { title: string; classroomCourseId?: string | null }[];
  learning: { topic: string; subject: string | null };
  covers: Record<string, string>;
};

export type FolderPlan = { title: string; classroomCourseId: string | null; challenges: boolean };
export type NotebookPlan = { name: string; study: boolean; groupLabel: string | null; cover: NotebookCover | null; folders: FolderPlan[] };
export type StarterPlan = { notebooks: NotebookPlan[]; learning: { topic: string; notebook: string; subject: string } | null };

// What you do → your notebooks, named in your language (tr). "Estudios"
// gets the study tools; projects and personal are plain notebooks.
export function notebooksFor(roles: Role[], tr: (s: string) => string = (s) => s): { name: string; study: boolean; groupLabel: string | null }[] {
  const set = new Set(roles);
  const out: { name: string; study: boolean; groupLabel: string | null }[] = [];
  if (set.has("study")) out.push({ name: tr("Estudios"), study: true, groupLabel: tr("Tema") });
  if (set.has("projects")) out.push({ name: tr("Proyectos"), study: false, groupLabel: null });
  if (set.has("personal")) out.push({ name: tr("Personal"), study: false, groupLabel: null });
  return out.length ? out : [{ name: tr("Estudios"), study: true, groupLabel: tr("Tema") }, { name: tr("Personal"), study: false, groupLabel: null }];
}

// Subjects where coding challenges make sense get the "Retos" block.
export const looksLikeProgramming = (title: string) =>
  /program|c[oó]digo|java|python|typescript|react|kotlin|android|\bsql\b|bases? de datos|software|\bweb\b|pmdm|dwec|dwes|algoritm/i.test(title);

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Sanitizes whatever the browser sent into a plan the database writes can
// trust: known roles, trimmed and de-duplicated subjects, real covers, and
// this week's topic attached to a real folder.
export function planStarterSpace(input: OnboardingAnswers, tr: (s: string) => string = (s) => s): StarterPlan {
  const roles = (Array.isArray(input?.roles) ? input.roles : []).filter((r): r is Role => ROLES.some((x) => x.key === r));
  const covers = input?.covers && typeof input.covers === "object" ? input.covers : {};
  const notebooks: NotebookPlan[] = notebooksFor(roles, tr).map((n) => ({
    ...n,
    cover: (NOTEBOOK_COVERS as readonly string[]).includes(covers[n.name]) ? (covers[n.name] as NotebookCover) : null,
    folders: [],
  }));

  const home = notebooks.find((n) => n.study) ?? notebooks[0];
  const seen = new Set<string>();
  for (const s of Array.isArray(input?.subjects) ? input.subjects : []) {
    const title = clean(s?.title, 60);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const course = clean(s?.classroomCourseId, 40);
    home.folders.push({ title, classroomCourseId: course || null, challenges: home.study && looksLikeProgramming(title) });
    if (home.folders.length >= 12) break;
  }

  const topic = clean(input?.learning?.topic, 200);
  if (!topic) return { notebooks, learning: null };
  const wanted = clean(input?.learning?.subject, 60).toLowerCase();
  const folder = home.folders.find((f) => f.title.toLowerCase() === wanted) ?? home.folders[0];
  if (folder) return { notebooks, learning: { topic, notebook: home.name, subject: folder.title } };
  const title = clean(topic, 60);
  home.folders.push({ title, classroomCourseId: null, challenges: home.study && looksLikeProgramming(title) });
  return { notebooks, learning: { topic, notebook: home.name, subject: title } };
}
