export type SM2State = { interval: number; easeFactor: number; repetitions: number };

// SuperMemo-2 never lets the ease factor drop below this — without a
// floor, a couple of hard cards would spiral toward 0 and effectively
// never space out, showing up every single day forever.
export const MIN_EASE_FACTOR = 1.3;

export const DEFAULT_SM2_STATE: SM2State = {
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
};

// The SM-2 algorithm (as used by Anki and the original SuperMemo) — given
// the card's current state and a 0-5 self-rated recall quality, decides
// how many days to wait before showing it again. It only needs the last
// state, not full review history, which is what makes it "simple" enough
// to store as three numbers per card.
//
// quality: 0-2 means "forgotten" (restart the spacing), 3-5 means
// "recalled it" (space it out further, more so the higher the quality).
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
  const interval =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.interval * easeFactor);

  return { interval, easeFactor, repetitions };
}

export function dueDateAfter(interval: number, from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + interval);
  return due;
}
