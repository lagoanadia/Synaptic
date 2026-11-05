export type SM2State = { interval: number; easeFactor: number; repetitions: number };

// SuperMemo-2 never lets the ease factor drop below this — without a
// floor, a couple of hard cards would spiral toward 0 and effectively
// never space out, showing up every single day forever.
export const MIN_EASE_FACTOR = 1.3;

// Without a cap, repeated "Easy" grows the interval until setDate overflows.
export const MAX_INTERVAL_DAYS = 10000;

export const DEFAULT_SM2_STATE: SM2State = {
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
};

// SM-2 (Anki's algorithm): from the card's last state and a 0-5 recall rating,
// the days until the next review. 0-2 restarts the spacing, 3-5 extends it.
export function computeNextReview(state: SM2State, quality: number): SM2State {
  // Updated on every review, pass or fail — a card that's been hard to
  // recall before should keep ramping up more slowly even after it's
  // eventually gotten right again.
  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (quality < 3) {
    return { interval: 1, easeFactor, repetitions: 0 };
  }

  const repetitions = state.repetitions + 1;
  const interval = Math.min(
    MAX_INTERVAL_DAYS,
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.interval * easeFactor),
  );

  return { interval, easeFactor, repetitions };
}

export function dueDateAfter(interval: number, from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + interval);
  return due;
}
