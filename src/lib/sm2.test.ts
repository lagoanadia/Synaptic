import { describe, expect, it } from "vitest";
import { computeNextReview, dueDateAfter, DEFAULT_SM2_STATE, MIN_EASE_FACTOR } from "./sm2";

describe("computeNextReview", () => {
  it("gives a 1-day interval on the very first success", () => {
    const result = computeNextReview(DEFAULT_SM2_STATE, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it("gives a 6-day interval on the second consecutive success", () => {
    const first = computeNextReview(DEFAULT_SM2_STATE, 4);
    const second = computeNextReview(first, 4);
    expect(second.interval).toBe(6);
    expect(second.repetitions).toBe(2);
  });

  it("multiplies the interval by the ease factor from the third success onward", () => {
    const first = computeNextReview(DEFAULT_SM2_STATE, 5);
    const second = computeNextReview(first, 5);
    const third = computeNextReview(second, 5);
    // The interval uses the ease factor as just updated by *this* review,
    // not the one going in — that's what makes an easy card's spacing
    // grow faster call over call.
    expect(third.interval).toBe(Math.round(second.interval * third.easeFactor));
    expect(third.repetitions).toBe(3);
  });

  it("resets repetitions and interval to 1 on a forgotten card (quality < 3)", () => {
    const afterSuccesses = computeNextReview(computeNextReview(DEFAULT_SM2_STATE, 5), 5);
    const forgotten = computeNextReview(afterSuccesses, 1);
    expect(forgotten.interval).toBe(1);
    expect(forgotten.repetitions).toBe(0);
  });

  it("increases the ease factor for a high-quality recall", () => {
    const result = computeNextReview(DEFAULT_SM2_STATE, 5);
    expect(result.easeFactor).toBeGreaterThan(DEFAULT_SM2_STATE.easeFactor);
  });

  it("decreases the ease factor for a low-quality recall", () => {
    const result = computeNextReview(DEFAULT_SM2_STATE, 3);
    expect(result.easeFactor).toBeLessThan(DEFAULT_SM2_STATE.easeFactor);
  });

  it("never lets the ease factor drop below the floor", () => {
    let state = DEFAULT_SM2_STATE;
    for (let i = 0; i < 20; i++) {
      state = computeNextReview(state, 0);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
  });
});

describe("dueDateAfter", () => {
  it("adds the given number of days to the reference date", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const due = dueDateAfter(6, from);
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-07");
  });
});
