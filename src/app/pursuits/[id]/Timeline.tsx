import Link from "next/link";
import { autoTitle } from "@/lib/text";

type TimelineEntry =
  | { type: "dump"; id: string; createdAt: Date; content: string | null }
  | { type: "note"; id: string; createdAt: Date; content: string };

// Purely derived from data this page already loads (BrainDump/Note
// createdAt) — no new table, no new query. A dedicated "event log" table
// would need every Server Action that touches a pursuit to remember to
// write to it too, which is a lot more to keep in sync for what's so far
// just "when did these two kinds of things happen".
export function Timeline({
  pursuitId,
  dumps,
  notes,
}: {
  pursuitId: string;
  dumps: { id: string; createdAt: Date; content: string | null }[];
  notes: { id: string; createdAt: Date; content: string }[];
}) {
  const entries: TimelineEntry[] = [
    ...dumps.map((d): TimelineEntry => ({ type: "dump", ...d })),
    ...notes.map((n): TimelineEntry => ({ type: "note", ...n })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing captured yet.</p>;
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <Link
          key={`${entry.type}-${entry.id}`}
          href={
            entry.type === "dump"
              ? `/pursuits/${pursuitId}/dump/${entry.id}`
              : `/pursuits/${pursuitId}?tab=organized#${entry.id}`
          }
          className="flex items-center gap-3 border-b border-dashed border-border-subtle py-3 last:border-0 hover:bg-chip"
        >
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              entry.type === "note" ? "bg-accent" : "bg-ink-faint"
            }`}
          />
          <span className="w-16 flex-shrink-0 text-xs text-ink-faint">
            {entry.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })}
          </span>
          <span className="text-xs whitespace-nowrap text-ink-faint uppercase">
            {entry.type === "note" ? "Organized" : "Dump"}
          </span>
          <span className="flex-1 truncate text-sm">{autoTitle(entry.content)}</span>
        </Link>
      ))}
    </div>
  );
}
