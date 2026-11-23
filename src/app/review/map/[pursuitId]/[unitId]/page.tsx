import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderMap } from "@/lib/blockData";
import { folderColor } from "@/lib/covers";
import { markOf } from "@/lib/calmMap";
import { getT } from "@/lib/i18n/server";
import { Wardrobe } from "../../../Wardrobe";
import { Dot, ORDER, Ring, known, sunflower } from "../../dots";

// One unit: all its concepts as dots in one big circle (names only for
// the red ones, the rest on hover), its progress, and three ways in.
export default async function ReviewUnitPage({ params }: { params: Promise<{ pursuitId: string; unitId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { pursuitId, unitId } = await params;
  const t = await getT();
  const folder = await prisma.pursuit.findFirst({ where: { AND: [accessiblePursuits(session.user.id), { id: pursuitId }] }, select: { id: true, title: true, cover: true } });
  if (!folder) notFound();
  const unit = (await folderMap(folder.id, folderColor(folder.id, folder.cover))).find((c) => c.id === unitId);
  if (!unit) notFound();

  const now = new Date().getTime();
  const dots = unit.nodes.map((n) => ({ ...n, mark: markOf(n, now) })).sort((a, b) => ORDER.indexOf(a.mark) - ORDER.indexOf(b.mark));
  const marks = dots.map((d) => d.mark);
  const pct = known(marks);
  const red = marks.filter((m) => m === "r").length;
  const S = 640;
  const R = S / 2 - 8;
  const pts = sunflower(dots.length, R - 40);
  const dr = dots.length > 80 ? 5 : 8;
  const scope = `pursuit=${folder.id}${unitId.startsWith("map-") ? "" : `&unit=${unitId}`}`;

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-1 flex-col gap-4 px-6 py-6 sm:px-10">
      <header className="flex items-center gap-4">
        <nav className="flex-1 text-sm text-ink-faint">
          <Link href="/review/map" className="hover:text-ink hover:underline">{t("Mapa")}</Link>
          <span className="mx-1.5">/</span>
          <span>{folder.title}</span>
        </nav>
        <Wardrobe light />
      </header>
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[640px]" role="img" aria-label={t("Mapa de conceptos")}>
          <circle cx={S / 2} cy={S / 2} r={R} fill="var(--color-callout)" />
          <Ring cx={S / 2} cy={S / 2} r={R} pct={pct} width={6} />
          {dots.map((d, i) => {
            const [x, y] = pts[i];
            return (
              <Link key={d.id} href={d.href}>
                <g className="cursor-pointer transition-opacity hover:opacity-75">
                  <title>{d.title}</title>
                  <Dot mark={d.mark} x={S / 2 + x} y={S / 2 + y} r={dr} />
                  {d.mark === "r" && (
                    <text x={S / 2 + x} y={S / 2 + y + dr + 14} textAnchor="middle" fontSize={11.5} fontWeight={600} className="fill-ink" style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}>
                      {d.title.length > 22 ? `${d.title.slice(0, 21)}…` : d.title}
                    </text>
                  )}
                </g>
              </Link>
            );
          })}
        </svg>
        <div className="flex flex-col items-start gap-6">
          <div>
            <div className="text-sm text-ink-faint">{folder.title}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{unit.label}</h1>
          </div>
          <div className="flex items-center gap-4">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
              <Ring cx={28} cy={28} r={23} pct={pct} width={6} />
              <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight={800} className="fill-ink">{Math.round(pct * 100)}%</text>
            </svg>
            {red > 0 && <span className="font-bold text-[#e16259]">{t("{0} para repasar", { 0: red })}</span>}
          </div>
          <div className="flex flex-col items-start gap-2.5">
            <Link href={`/review?${scope}&practice=1`} className="rounded-full bg-accent px-6 py-3 font-bold text-white shadow-[0_4px_12px_rgba(35,131,226,.3)] hover:brightness-95">
              ▶ {t("Quiz rápido")}
            </Link>
            <Link href={`/review/final?pursuit=${folder.id}`} className="rounded-full px-6 py-2 font-bold text-ink-muted hover:bg-chip hover:text-ink">
              {t("Test final")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
