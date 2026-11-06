import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { progress, type Status } from "@/lib/internalize";
import { NewMapForm } from "./NewMapForm";

export async function LearnTab({ pursuitId, hasNotes }: { pursuitId: string; hasNotes: boolean }) {
  const maps = await prisma.conceptMap.findMany({
    where: { pursuitId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, sourceKind: true, sourceRef: true, concepts: { select: { status: true } } },
  });

  return (
    <div className={maps.length ? "grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_460px]" : "mx-auto w-full max-w-2xl"}>
      {maps.length > 0 && (
      <section className="flex flex-col gap-3" aria-label="Concept maps">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {maps.map((m) => {
            const p = progress(m.concepts.map((c) => c.status as Status));
            const pct = (n: number) => `${p.total ? (n / p.total) * 100 : 0}%`;
            return (
              <Link
                key={m.id}
                href={`/pursuits/${pursuitId}/learn/${m.id}`}
                className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">{m.title}</span>
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-xs text-ink-muted">
                    {m.sourceKind}
                  </span>
                </div>
                {m.sourceRef && <span className="-mt-2 truncate text-xs text-ink-faint">{m.sourceRef}</span>}
                <div className="flex h-2 overflow-hidden rounded-full bg-chip" aria-hidden>
                  <span className="bg-tile-deep" style={{ width: pct(p.mastered) }} />
                  <span className="bg-tile-sky" style={{ width: pct(p.understood) }} />
                  <span className="bg-amber" style={{ width: pct(p.reread) }} />
                </div>
                <span className="text-xs font-semibold text-ink-muted">
                  {p.mastered + p.understood}/{p.total}
                  {p.reread > 0 && <span className="text-amber"> · {p.reread} to reread</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      )}
      <NewMapForm pursuitId={pursuitId} hasNotes={hasNotes} />
    </div>
  );
}
