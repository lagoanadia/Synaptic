import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderMap } from "@/lib/blockData";
import { folderColor } from "@/lib/covers";
import { markOf } from "@/lib/calmMap";
import { getT } from "@/lib/i18n/server";
import { Wardrobe } from "../Wardrobe";
import { ORDER, UnitBall, known } from "./dots";

// Repasar's front door: every subject with its units as circles of dots,
// and what's due today. A unit opens its map; the strip starts today's
// review.
export default async function ReviewMapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const t = await getT();

  const folders = await prisma.pursuit.findMany({
    where: { AND: [accessiblePursuits(userId), { loose: false }, { section: { study: true, OR: [{ kind: "study" }, { kind: null }] } }] },
    orderBy: [{ section: { order: "asc" } }, { createdAt: "asc" }],
    select: { id: true, title: true, cover: true },
  });
  const now = new Date().getTime();
  const subjects = (
    await Promise.all(
      folders.map(async (f) => ({
        ...f,
        units: (await folderMap(f.id, folderColor(f.id, f.cover))).map((c) => {
          const marks = c.nodes.map((n) => markOf(n, now)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
          return { id: c.id, label: c.label, marks, pct: known(marks) };
        }),
      })),
    )
  ).filter((s) => s.units.length > 0);
  const due = Math.min(
    12,
    await prisma.flashcard.count({ where: { pursuit: accessiblePursuits(userId), dueDate: { lte: new Date() } } }),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 px-6 py-8 sm:px-12">
      <header className="flex items-center gap-4">
        <h1 className="flex-1 text-3xl font-extrabold tracking-tight">{t("Mapa")}</h1>
        <Wardrobe light />
      </header>

      {subjects.length === 0 ? (
        <p className="text-ink-muted">{t("Cuando tus apuntes tengan conceptos, aparecerán aquí.")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {subjects.map((s) => (
            <section key={s.id} className="rounded-2xl bg-white px-5 pt-4 pb-3 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_2px_6px_rgba(15,15,15,.04),0_14px_30px_-18px_rgba(15,15,15,.22)] dark:bg-[#202020]">
              <h2 className="mb-1 text-[15px] font-extrabold">{s.title}</h2>
              <div className="flex flex-wrap justify-around gap-x-2 gap-y-1">
                {s.units.map((u) => (
                  <Link key={u.id} href={`/review/map/${s.id}/${u.id}`} className="group flex w-28 flex-col items-center gap-1 rounded-xl py-1.5 transition hover:bg-hover">
                    <span className="transition-transform group-hover:scale-105">
                      <UnitBall marks={u.marks} pct={u.pct} />
                    </span>
                    <span className="max-w-full truncate text-[13px] font-bold">{u.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {due > 0 && (
        <div className="flex items-center gap-4 rounded-2xl bg-[#fdf3f2] px-5 py-4 shadow-[0_0_0_1px_#f6d9d5] dark:bg-[#2c1f1f] dark:shadow-[0_0_0_1px_#4a2a2a]">
          <span className="text-3xl leading-none font-extrabold text-[#e16259]">{due}</span>
          <span className="flex-1 font-bold">{t("para repasar hoy")}</span>
          <Link href="/review" className="rounded-full bg-[#e16259] px-5 py-2.5 text-sm font-bold text-white hover:brightness-95">
            {t("Repasar")} ▸
          </Link>
        </div>
      )}
    </div>
  );
}
