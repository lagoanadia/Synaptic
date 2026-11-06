import Link from "next/link";
import { BoltIcon, CardsIcon, QuestionIcon } from "../icons";

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
    { mode: "learn", label: "Learn", hint: `${cardCount} items`, icon: QuestionIcon, enabled: cardCount + conceptCount > 0 },
    { mode: "flash", label: "Flashcards", hint: dueCount > 0 ? `${dueCount} due` : "Up to date", icon: CardsIcon, enabled: cardCount > 0 },
    { mode: "match", label: "Match", hint: "Beat your time", icon: BoltIcon, enabled: cardCount >= 3 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
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
              title="Needs flashcards"
            >
              <g.icon size={22} />
              <span className="flex flex-col">
                <span className="text-sm font-bold">{g.label}</span>
                <span className="text-xs">{g.hint}</span>
              </span>
            </div>
          ),
        )}
        <Link
          href={`/challenges${scopeQuery.startsWith("pursuit=") ? `?${scopeQuery}` : ""}`}
          className="col-span-3 flex items-center gap-3 rounded-2xl bg-mint px-4 py-3.5 text-white transition-transform hover:-translate-y-0.5"
        >
          <span className="font-mono text-lg font-bold">{"</>"}</span>
          <span className="flex flex-col">
            <span className="text-sm font-bold">Code challenge</span>
            <span className="text-xs">From your notes</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
