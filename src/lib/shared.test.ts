import { describe, expect, it } from "vitest";
import { bestDay, settle } from "./shared";

describe("settle", () => {
  it("splits equally and pays back whoever paid", () => {
    expect(settle([{ paidById: "a", amount: 300 }], ["a", "b", "c"])).toEqual([
      { from: "b", to: "a", cents: 100 },
      { from: "c", to: "a", cents: 100 },
    ]);
  });
  it("nets out several expenses with few payments", () => {
    const debts = settle([{ paidById: "a", amount: 4000 }, { paidById: "b", amount: 2000 }], ["a", "b", "c"]);
    expect(debts).toEqual([
      { from: "c", to: "a", cents: 2000 },
    ]);
  });
  it("keeps the total exact with odd cents", () => {
    const debts = settle([{ paidById: "a", amount: 100 }], ["a", "b", "c"]);
    expect(debts.reduce((t, d) => t + d.cents, 0)).toBe(66);
  });
  it("nothing to settle when even", () => {
    expect(settle([], ["a", "b"])).toEqual([]);
  });
});

describe("bestDay", () => {
  it("most votes, earliest on a tie, null with no votes", () => {
    expect(bestDay([{ day: "2026-12-02", votes: 2 }, { day: "2026-12-01", votes: 2 }, { day: "2026-11-30", votes: 1 }])).toBe("2026-12-01");
    expect(bestDay([{ day: "2026-12-02", votes: 0 }])).toBeNull();
  });
});
