// The welcome flow's answers → the notebooks and folders to create. Pure,
// so the browser can preview "Tu espacio" with it and it's unit-tested.

import { NOTEBOOK_COVERS, type NotebookCover } from "@/lib/covers";

export const ROLES = [
  { key: "fp", label: "FP" },
  { key: "uni", label: "Universidad" },
  { key: "bach", label: "Bachillerato" },
  { key: "work", label: "Trabajo" },
  { key: "projects", label: "Proyectos propios" },
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

const STUDY: Partial<Record<Role, string>> = { fp: "Unidad", uni: "Tema", bach: "Tema" };

// What you do → your notebooks. Anything you study becomes one "Estudios"
// notebook with study tools; work, projects and personal are plain ones.
export function notebooksFor(roles: Role[]): { name: string; study: boolean; groupLabel: string | null }[] {
  const set = new Set(roles);
  const out: { name: string; study: boolean; groupLabel: string | null }[] = [];
  const study = ROLES.map((r) => r.key).find((k) => set.has(k) && STUDY[k]);
  if (study) out.push({ name: "Estudios", study: true, groupLabel: STUDY[study] ?? null });
  if (set.has("work")) out.push({ name: "Trabajo", study: false, groupLabel: null });
  if (set.has("projects")) out.push({ name: "Proyectos", study: false, groupLabel: null });
  if (set.has("personal")) out.push({ name: "Personal", study: false, groupLabel: null });
  return out.length ? out : [{ name: "Estudios", study: true, groupLabel: "Tema" }, { name: "Personal", study: false, groupLabel: null }];
}

// Subjects where coding challenges make sense get the "Retos" block.
export const looksLikeProgramming = (title: string) =>
  /program|c[oó]digo|java|python|typescript|react|kotlin|android|\bsql\b|bases? de datos|software|\bweb\b|pmdm|dwec|dwes|algoritm/i.test(title);

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Sanitizes whatever the browser sent into a plan the database writes can
// trust: known roles, trimmed and de-duplicated subjects, real covers, and
// this week's topic attached to a real folder.
export function planStarterSpace(input: OnboardingAnswers): StarterPlan {
  const roles = (Array.isArray(input?.roles) ? input.roles : []).filter((r): r is Role => ROLES.some((x) => x.key === r));
  const covers = input?.covers && typeof input.covers === "object" ? input.covers : {};
  const notebooks: NotebookPlan[] = notebooksFor(roles).map((n) => ({
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
