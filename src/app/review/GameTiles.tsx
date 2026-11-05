import Link from "next/link";
import { BoltIcon, CardsIcon, GamepadIcon, QuestionIcon, SparkIcon } from "../icons";

// The 2×2 "play" block from the prototype (the gamepad under Concepts).
// Each tile opens /review in one mode, scoped to wherever it's shown.
export function GameTiles({
  scopeQuery,
  cardCount,
  dueCount,
  conceptCount,
}: {
  // e.g. "section=abc" or "pursuit=xyz" — appended to every link.
  scopeQuery: string;
  cardCount: number;
  dueCount: number;
  conceptCount: number;
}) {
  const href = (mode: string) => `/review?mode=${mode}${scopeQuery ? `&${scopeQuery}` : ""}`;
  const games = [
    {
      mode: "quiz",
      label: "Quiz",
      hint: cardCount >= 3 ? "Multiple choice" : "Needs 3+ cards",
      icon: QuestionIcon,
      enabled: cardCount >= 3,
    },
    {
      mode: "recall",
      label: "Recall",
      hint: conceptCount > 0 ? "Random concepts" : "No concepts yet",
      icon: SparkIcon,
      enabled: conceptCount > 0,
    },
    {
      mode: "flash",
      label: "Flashcards",
      hint: dueCount > 0 ? `${dueCount} due` : "All caught up",
      icon: CardsIcon,
      enabled: cardCount > 0,
    },
    {
      mode: "challenge",
      label: "Challenge",
      hint: "60-second sprint",
      icon: BoltIcon,
      enabled: cardCount >= 3,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-ink">
        <GamepadIcon size={22} />
        <h2 className="text-sm font-bold">Play</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {games.map((g) =>
          g.enabled ? (
            <Link
              key={g.mode}
              href={href(g.mode)}
              className="flex items-center gap-3 rounded-2xl bg-tile-sky px-4 py-3.5 text-white transition-transform hover:-translate-y-0.5"
            >
              <g.icon size={22} />
              <span className="flex flex-col">
                <span className="text-sm font-bold">{g.label}</span>
                <span className="text-xs">{g.hint}</span>
              </span>
            </Link>
          ) : (
            <div
              key={g.mode}
              className="flex items-center gap-3 rounded-2xl bg-chip px-4 py-3.5 text-ink-muted"
              title="Organize notes and generate flashcards (Cards tab) to unlock this"
            >
              <g.icon size={22} />
              <span className="flex flex-col">
                <span className="text-sm font-bold">{g.label}</span>
                <span className="text-xs">{g.hint}</span>
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
