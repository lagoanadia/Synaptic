import { describe, expect, it } from "vitest";
import { looksLikeProgramming, notebooksFor, planStarterSpace } from "./onboardingPlan";

describe("notebooksFor", () => {
  it("turns what you do into notebooks, one study notebook at most", () => {
    expect(notebooksFor(["fp", "uni", "projects", "personal"])).toEqual([
      { name: "Estudios", study: true, groupLabel: "Unidad" },
      { name: "Proyectos", study: false, groupLabel: null },
      { name: "Personal", study: false, groupLabel: null },
    ]);
    expect(notebooksFor(["uni"])[0].groupLabel).toBe("Tema");
  });
  it("has a sensible default", () => {
    expect(notebooksFor([]).map((n) => n.name)).toEqual(["Estudios", "Personal"]);
  });
});

describe("looksLikeProgramming", () => {
  it("spots coding subjects", () => {
    expect(looksLikeProgramming("Programación")).toBe(true);
    expect(looksLikeProgramming("Bases de datos")).toBe(true);
    expect(looksLikeProgramming("PMDM")).toBe(true);
    expect(looksLikeProgramming("Inglés")).toBe(false);
    expect(looksLikeProgramming("Diseño de interfaces")).toBe(false);
  });
});

describe("planStarterSpace", () => {
  it("puts subjects in the study notebook, dedupes and attaches the topic", () => {
    const plan = planStarterSpace({
      roles: ["fp", "personal"],
      subjects: [{ title: " DI " }, { title: "di" }, { title: "Programación", classroomCourseId: "123" }],
      learning: { topic: "Joins en SQL", subject: "programación" },
      covers: { Estudios: "zebra", Personal: "not-a-cover" },
    });
    expect(plan.notebooks[0]).toEqual({
      name: "Estudios",
      study: true,
      groupLabel: "Unidad",
      cover: "zebra",
      folders: [
        { title: "DI", classroomCourseId: null, challenges: false },
        { title: "Programación", classroomCourseId: "123", challenges: true },
      ],
    });
    expect(plan.notebooks[1].cover).toBeNull();
    expect(plan.learning).toEqual({ topic: "Joins en SQL", notebook: "Estudios", subject: "Programación" });
  });

  it("creates a folder for the topic when there are no subjects", () => {
    const plan = planStarterSpace({ roles: ["projects"], subjects: [], learning: { topic: "React", subject: null }, covers: {} });
    expect(plan.notebooks[0].folders.map((f) => f.title)).toEqual(["React"]);
    expect(plan.learning?.subject).toBe("React");
  });

  it("caps sizes and survives garbage input", () => {
    const plan = planStarterSpace({ roles: ["fp"], subjects: Array.from({ length: 30 }, (_, i) => ({ title: `S${i}` })), learning: { topic: "", subject: null }, covers: {} });
    expect(plan.notebooks[0].folders).toHaveLength(12);
    expect(plan.learning).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(planStarterSpace(null as any).notebooks.map((n) => n.name)).toEqual(["Estudios", "Personal"]);
  });
});
