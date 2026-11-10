import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseAvatar, randomAvatar } from "@/lib/avatar";
import Link from "next/link";
import { BILLING } from "@/lib/billingFlag";
import { ProfileEditor } from "./ProfileEditor";
import { Friends, type Friend } from "./Friends";

export const metadata = { title: "Tu perfil" };

export default async function ProfilePage() {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, username: true, avatar: true } });
  if (!user) redirect("/");
  // No avatar yet: start from a random one, so nobody looks the same.
  const avatar = user.avatar ? parseAvatar(user.avatar) : randomAvatar();
  const person = { select: { id: true, name: true, email: true, username: true, avatar: true } } as const;
  const links = await prisma.friendship.findMany({
    where: { OR: [{ fromId: session.user.id }, { toId: session.user.id }] },
    include: { from: person, to: person },
    orderBy: { createdAt: "desc" },
  });
  const friends: Friend[] = links.map((l) => {
    const mine = l.fromId === session.user!.id;
    const other = mine ? l.to : l.from;
    return {
      id: l.id,
      state: l.status === "ACCEPTED" ? "friend" : mine ? "sent" : "received",
      name: other.name ?? other.username ?? other.email.split("@")[0],
      username: other.username,
      avatar: other.avatar ? parseAvatar(other.avatar) : null,
    };
  });
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8 px-6 py-8 sm:px-12 lg:py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[2.1rem] leading-tight font-bold tracking-tight">{t("Tu perfil")}</h1>
        {BILLING && (
          <Link href="/billing" className="rounded-md px-3 py-1.5 text-sm text-ink-faint hover:bg-chip hover:text-ink">
            {t("Plan y facturación")}
          </Link>
        )}
      </header>
      <ProfileEditor name={user.name ?? user.email} username={user.username} initial={avatar} saved={!!user.avatar} />
      <Friends friends={friends} hasHandle={!!user.username} />
    </div>
  );
}
