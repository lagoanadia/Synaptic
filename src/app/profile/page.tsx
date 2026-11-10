import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseAvatar, randomAvatar } from "@/lib/avatar";
import Link from "next/link";
import { BILLING } from "@/lib/billingFlag";
import { ProfileEditor } from "./ProfileEditor";
import { Settings } from "./Settings";
import { baseHandle, freeHandle } from "@/lib/username";
import { Friends, type Friend } from "./Friends";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Tu perfil")  };
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = raw === "friends" || raw === "settings" ? raw : "avatar";
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, username: true, avatar: true, codes: true, plan: true, accounts: { select: { provider: true } }, calendarConnection: { select: { userId: true } }, classroomConnection: { select: { userId: true } } } });
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[2.1rem] leading-tight font-bold tracking-tight">{t("Tu perfil")}</h1>
        <nav className="flex rounded-[10px] bg-chip p-[3px] text-sm" aria-label={t("Perfil")}>
          {(
            [
              ["avatar", t("Avatar")],
              ["friends", t("Amigos")],
              ["settings", t("Ajustes")],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} href={k === "avatar" ? "/profile" : `/profile?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`rounded-lg px-4 py-1.5 ${tab === k ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {label}
              {k === "friends" && friends.some((f) => f.state === "received") && <span className="ml-1.5 inline-block size-2 rounded-full bg-[#e16259]" />}
            </Link>
          ))}
        </nav>
      </header>
      {tab === "avatar" && <ProfileEditor name={user.name ?? user.email} username={user.username} suggested={user.username ?? (await freeHandle(baseHandle(user.name, user.email), session.user.id))} initial={avatar} saved={!!user.avatar} />}
      {tab === "friends" && <Friends friends={friends} hasHandle={!!user.username} />}
      {tab === "settings" && (
        <Settings
          codes={user.codes}
          calendar={!!user.calendarConnection}
          classroom={!!user.classroomConnection}
          signIns={[...new Set(user.accounts.map((a) => (a.provider === "github" ? "GitHub" : a.provider === "google" ? "Google" : a.provider)))]}
          plan={BILLING ? user.plan : null}
        />
      )}
    </div>
  );
}
