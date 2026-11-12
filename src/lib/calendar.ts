// Calendar maths, kept pure. Days are keyed "YYYY-MM-DD" in the app's time
// zone (Spain), so the server (UTC) and the browser agree on which day an
// event falls on.

export const APP_TZ = "Europe/Madrid";

export type CalKind = "exam" | "task" | "event" | "due" | "google";
export type DotState = "todo" | "known" | "fading";

export type CalItem = {
  id: string;
  title: string;
  kind: CalKind;
  day: string; // YYYY-MM-DD
  time: string | null; // "17:00", or null for all day
  color: string;
  folderId: string | null;
  folder: string | null;
  unitId: string | null;
  unit: string | null;
  href: string | null;
  done: boolean;
  // Exams: what it covers, one dot per concept of its unit.
  dots?: DotState[];
  // Ours, so it can be edited/deleted here.
  editable: boolean;
  // Google events: which of your calendars it's from (for its own colour
  // and filter).
  calendarId?: string;
  calendarName?: string;
};

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const dayKey = (d: Date) => keyFmt.format(d);
export const timeOf = (d: Date) => timeFmt.format(d);

// A key as a Date at noon UTC: safe to add days to and format.
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = Monday … 6 = Sunday.
export const weekday = (key: string) => (fromKey(key).getUTCDay() + 6) % 7;

// The 7 days (Mon–Sun) of the week containing `key`.
export function weekOf(key: string): string[] {
  const start = addDays(key, -weekday(key));
  return [...Array(7)].map((_, i) => addDays(start, i));
}

// Whole weeks (Mon–Sun) covering a month: 5 or 6 rows of 7 keys.
export function monthGrid(year: number, month: number): string[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = addDays(first, -weekday(first));
  const last = addDays(`${month === 12 ? year + 1 : year}-${String((month % 12) + 1).padStart(2, "0")}-01`, -1);
  const rows: string[][] = [];
  for (let k = start; k <= last; k = addDays(k, 7)) rows.push(weekOf(k));
  return rows;
}

// "2026-11" ⇄ year/month, clamped to something sensible.
export function parseMonth(m: string | undefined, today: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  const [y, mo] = match ? [Number(match[1]), Number(match[2])] : today.split("-").map(Number);
  return { year: Math.min(2100, Math.max(2000, y)), month: Math.min(12, Math.max(1, mo)) };
}

export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
export const shiftMonth = (year: number, month: number, n: number) => {
  const i = year * 12 + (month - 1) + n;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
};

// "November" / "Noviembre" / "November" (1-12), in the given locale.
export function monthName(m: number, locale: string) {
  const s = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// Exams first, then deliverables, tasks, the rest; then by time.
const ORDER: Record<CalKind, number> = { exam: 0, due: 1, task: 2, event: 3, google: 4 };
export function sortItems(items: CalItem[]): CalItem[] {
  return [...items].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

// A Google event id we control: Google accepts base32hex (0-9, a-v), and hex
// is a subset, so the same Synaptic item always maps to the same event.
export const googleIdFor = (prefix: string, id: string) => `s${prefix}${Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, "0")).join("")}`;

// A wall-clock time in Spain ("2026-11-06", "17:30") as an instant,
// whatever the server's own time zone (and across summer time).
export function zonedDate(day: string, time: string): Date {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const name = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, timeZoneName: "longOffset" }).formatToParts(guess).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  const offset = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  return new Date(guess.getTime() - offset * 60000);
}
