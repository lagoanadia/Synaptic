import { ArrowLeft, TrashIcon } from "@/app/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../Logo";
import { fetchHeadlines } from "@/lib/feeds";
import { debateStats, type Verdict } from "@/lib/debate";
import { HeadlinePicker } from "./HeadlinePicker";
import { DeleteButton } from "../pursuits/DeleteButton";
import { deleteDebate } from "./actions";

export default async function ArenaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const [headlines, debates] = await Promise.all([
    fetchHeadlines(),
    prisma.debate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, motion: true, side: true, verdict: true, updatedAt: true },
    }),
  ]);
  const stats = debateStats(debates.flatMap((d) => (d.verdict ? [d.verdict as Verdict] : [])));

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-8 px-6 py-10 lg:px-14">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <Logo href="/pursuits" />
          <span className="text-ink-faint">·</span>
          <h1 className="text-2xl font-extrabold text-orchid italic">Arena</h1>
        </div>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline"><ArrowLeft /> Inicio</Link>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-3" aria-label="Titulares">
          <HeadlinePicker headlines={headlines} />
        </section>

        <aside className="flex flex-col gap-6 self-start">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
            <h2 className="font-extrabold">Cómo argumentas</h2>
            {stats.debates === 0 ? (
              <p className="text-sm text-ink-muted">Termina un debate para ver aquí tus puntuaciones y hábitos.</p>
            ) : (
              <>
                <p className="text-sm text-ink-muted">
                  {stats.debates} juzgados · {stats.wins} ganados
                </p>
                {(Object.entries(stats.averages) as [string, number][]).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-28 capitalize text-ink-muted">{k}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-chip">
                      <span className="block h-full rounded-full bg-orchid" style={{ width: `${(v / 5) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums">{v}</span>
                  </div>
                ))}
                {stats.topFallacies.length > 0 && (
                  <p className="text-xs text-ink-muted">
                    Cuidado con: {stats.topFallacies.map((f) => `${f.name} (${f.n}×)`).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-bold text-ink-muted">Tus debates</h2>
            {debates.length === 0 && <p className="px-1 text-sm text-ink-faint">Ninguno todavía.</p>}
            {debates.map((d) => {
              const v = d.verdict as Verdict | null;
              return (
                <div key={d.id} className="group flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(13,13,13,0.06)] hover:shadow-md">
                  <Link href={`/arena/${d.id}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 font-semibold">{d.motion}</span>
                    <span className="text-xs text-ink-muted">
                      Tú: {d.side === "for" ? "a favor" : "en contra"} · {v ? (v.winner === "you" ? "ganado" : v.winner === "ai" ? "perdido" : "empate") : "en curso"}
                    </span>
                  </Link>
                  <DeleteButton
                    action={deleteDebate.bind(null, d.id)}
                    confirmMessage="¿Eliminar este debate?"
                    className="rounded-full p-1 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                  >
                    <TrashIcon size={14} title="Eliminar debate" />
                  </DeleteButton>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
