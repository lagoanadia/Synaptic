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
import { ORDER } from "../../dots";
import { UnitView } from "./UnitView";

// One unit: all its concepts as dots in one big circle (names only for
// the red ones, the rest on hover), its progress, and three ways in
// (UnitView).
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
      <UnitView
        dots={dots.map((d) => ({ id: d.id, title: d.title, href: d.href, mark: d.mark }))}
        title={unit.label}
        subject={folder.title}
        scope={scope}
        finalHref={`/review/final?pursuit=${folder.id}`}
        back={`/review/map/${folder.id}/${unitId}`}
      />
    </div>
  );
}
