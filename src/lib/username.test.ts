import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { baseHandle } from "./username";

describe("baseHandle", () => {
  it("joins the name, drops accents and odd characters", () => {
    expect(baseHandle("Nadia Lagoa", null)).toBe("nadialagoa");
    expect(baseHandle("Lucía Pérez-Gómez", null)).toBe("luciaperezgomez");
  });
  it("falls back to the email and pads short ones", () => {
    expect(baseHandle(null, "jo@x.com")).toBe("jouser");
    expect(baseHandle("", "marc.vidal@gmail.com")).toBe("marc.vidal");
  });
  it("is at most 16 so a number fits", () => {
    expect(baseHandle("Maximiliano Fernández de la Torre", null).length).toBeLessThanOrEqual(16);
  });
});
