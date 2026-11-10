// Projects are folders in notebooks without study tools; their tasks live
// on the folder, the notebook's board and the home page.

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export const TASK_COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "TODO", label: "Por hacer", dot: "#c7c6c2" },
  { status: "IN_PROGRESS", label: "En curso", dot: "#337ea9" },
  { status: "DONE", label: "Hecho", dot: "#448361" },
];

export type TaskItem = { id: string; title: string; status: TaskStatus; dueDate: string | null; pursuitId: string; order: number };
export type ProjectItem = {
  id: string;
  title: string;
  cover: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  finished: boolean;
  tasks: TaskItem[];
};

export type ProjectState = "todo" | "doing" | "done";
export const STATE_LABEL: Record<ProjectState, { label: string; bg: string; fg: string }> = {
  todo: { label: "Sin empezar", bg: "#f1f1ef", fg: "#787774" },
  doing: { label: "En curso", bg: "#e7f3f8", fg: "#337ea9" },
  done: { label: "Hecho", bg: "#edf3ec", fg: "#448361" },
};

// Done when marked so, or when every task is done; not started while
// nothing has moved; in progress otherwise.
export function projectState(p: Pick<ProjectItem, "finished" | "tasks">): ProjectState {
  if (p.finished) return "done";
  if (p.tasks.length > 0 && p.tasks.every((t) => t.status === "DONE")) return "done";
  return p.tasks.some((t) => t.status !== "TODO") ? "doing" : "todo";
}

export const progress = (tasks: TaskItem[]) => ({ done: tasks.filter((t) => t.status === "DONE").length, total: tasks.length });

const byDueThenOrder = (a: TaskItem, b: TaskItem) =>
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.order - b.order;

// What to do next: something already started, else the earliest due.
export function nextTask(tasks: TaskItem[]): TaskItem | null {
  const doing = tasks.filter((t) => t.status === "IN_PROGRESS").sort(byDueThenOrder);
  return doing[0] ?? tasks.filter((t) => t.status === "TODO").sort(byDueThenOrder)[0] ?? null;
}

// "YYYY-MM-DD" of a date in Madrid.
export const dayOf = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// A due date as people say it: hoy, mañana, ayer, "jue 21" this week, "21 nov" later.
// With `t` and a locale it speaks the app's language; without, Spanish.
export function dueLabel(day: string, today: string, t: (s: string) => string = (s) => s, locale = "es-ES"): { text: string; late: boolean } {
  const [y, m, d] = day.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  const date = new Date(Date.UTC(y, m - 1, d));
  const text =
    diff === 0
      ? t("hoy")
      : diff === 1
        ? t("mañana")
        : diff === -1
          ? t("ayer")
          : locale.startsWith("es")
            ? diff > 1 && diff < 7
              ? `${WEEKDAYS[date.getUTCDay()]} ${d}`
              : `${d} ${MONTHS[m - 1]}`
            : date.toLocaleDateString(locale, diff > 1 && diff < 7 ? { weekday: "short", day: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
  return { text, late: diff < 0 };
}

// For the home's focus: started, due today or overdue, or done today.
export function isFocus(t: TaskItem, today: string, doneToday: boolean): boolean {
  if (t.status === "DONE") return doneToday;
  return t.status === "IN_PROGRESS" || (!!t.dueDate && t.dueDate <= today);
}
