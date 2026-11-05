import { describe, expect, it } from "vitest";
import { planStarterSpace } from "./onboarding";

describe("planStarterSpace", () => {
  it("trims, dedupes and attaches the topic to the chosen subject", () => {
    const plan = planStarterSpace({
      areas: [
        { name: " School ", items: ["AD", "ad", "  Bases de Datos "] },
        { name: "school", items: ["dup area"] },
      ],
      learning: { topic: "SQL joins", subject: "bases de datos" },
    });
    expect(plan.areas).toEqual([{ name: "School", items: ["AD", "Bases de Datos"] }]);
    expect(plan.learning).toEqual({ topic: "SQL joins", areaName: "School", subject: "Bases de Datos" });
  });

  it("falls back to the first subject when the chosen one doesn't exist", () => {
    const plan = planStarterSpace({
      areas: [{ name: "Work", items: [] }, { name: "School", items: ["AD"] }],
      learning: { topic: "Ficheros", subject: "nope" },
    });
    expect(plan.learning?.subject).toBe("AD");
  });

  it("creates a home for the topic when there are no subjects", () => {
    expect(planStarterSpace({ areas: [], learning: { topic: "React", subject: null } })).toEqual({
      areas: [{ name: "Learning", items: ["React"] }],
      learning: { topic: "React", areaName: "Learning", subject: "React" },
    });
    const withArea = planStarterSpace({ areas: [{ name: "Work", items: [] }], learning: { topic: "Excel", subject: null } });
    expect(withArea.areas[0].items).toEqual(["Excel"]);
  });

  it("caps sizes and survives garbage input", () => {
    const plan = planStarterSpace({
      areas: Array.from({ length: 10 }, (_, i) => ({ name: `A${i}`, items: Array.from({ length: 20 }, (_, j) => `i${j}`) })),
      learning: { topic: "", subject: null },
    });
    expect(plan.areas).toHaveLength(6);
    expect(plan.areas[0].items).toHaveLength(8);
    expect(plan.learning).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(planStarterSpace(null as any)).toEqual({ areas: [], learning: null });
  });
});
