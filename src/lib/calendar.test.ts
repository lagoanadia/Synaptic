import { describe, expect, it } from "vitest";
import { addDays, dayKey, googleIdFor, monthGrid, parseMonth, shiftMonth, sortItems, timeOf, weekOf, weekday, zonedDate, type CalItem } from "./calendar";

describe("calendar days", () => {
  it("keys days in Spanish time", () => {
    // 23:30 UTC on Nov 6 is already Nov 7 in Madrid.
    expect(dayKey(new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
    expect(dayKey(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-06");
  });
  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("starts weeks on Monday", () => {
    expect(weekday("2026-11-02")).toBe(0); // Monday
    expect(weekday("2026-11-08")).toBe(6); // Sunday
    expect(weekOf("2026-11-06")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });
  it("builds whole weeks around a month", () => {
    const nov = monthGrid(2026, 11);
    expect(nov[0][0]).toBe("2026-10-26");
    expect(nov.at(-1)![0]).toBe("2026-11-30"); // a Monday: its week runs into December
    expect(nov.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(nov.every((w) => w.length === 7)).toBe(true);
    // February 2027 starts on a Monday and fits in 4 weeks.
    expect(monthGrid(2027, 2)).toHaveLength(4);
  });
  it("parses and shifts months", () => {
    expect(parseMonth("2026-11", "2020-01-01")).toEqual({ year: 2026, month: 11 });
    expect(parseMonth("nope", "2026-05-09")).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth(2026, 12, 1)).toBe("2027-01");
    expect(shiftMonth(2026, 1, -1)).toBe("2025-12");
  });
});

describe("sortItems", () => {
  const item = (kind: CalItem["kind"], title: string, time: string | null = null): CalItem => ({
    id: title, title, kind, day: "2026-11-06", time, color: "", folderId: null, folder: null, unitId: null, unit: null, href: null, done: false, editable: false,
  });
  it("puts exams first, then deliverables, then by time", () => {
    const sorted = sortItems([item("google", "Gym", "19:00"), item("task", "Rediseño"), item("exam", "Examen"), item("google", "Dentista", "17:00"), item("due", "Entrega")]);
    expect(sorted.map((i) => i.title)).toEqual(["Examen", "Entrega", "Rediseño", "Dentista", "Gym"]);
  });
});

describe("googleIdFor", () => {
  it("is stable and only uses base32hex characters", () => {
    const id = googleIdFor("e", "cmw5c2mgc000dp37drmtiup74");
    expect(id).toBe(googleIdFor("e", "cmw5c2mgc000dp37drmtiup74"));
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  });
});

describe("zonedDate", () => {
  it("reads a Spanish wall-clock time, winter and summer", () => {
    expect(zonedDate("2026-11-06", "17:30").toISOString()).toBe("2026-11-06T16:30:00.000Z");
    expect(zonedDate("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(timeOf(zonedDate("2026-11-06", "17:30"))).toBe("17:30");
  });
});
