import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DebateMessage, Verdict } from "@/lib/debate";
import { DebateRoom } from "./DebateRoom";

export default async function DebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const d = await prisma.debate.findFirst({ where: { id, userId: session.user.id } });
  if (!d) notFound();
  return (
    <DebateRoom
      debate={{
        id: d.id,
        headline: d.headline,
        url: d.url,
        motion: d.motion,
        brief: d.brief,
        side: d.side as "for" | "against",
        messages: d.messages as DebateMessage[],
        verdict: d.verdict as Verdict | null,
      }}
    />
  );
}
