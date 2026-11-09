import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { handleFrom, parseAvatar } from "@/lib/avatar";
import { ProfileEditor } from "./ProfileEditor";

export const metadata = { title: "Tu perfil" };

// Everyone gets a free @handle the first time: their first name, plus a
// number if it's taken.
async function ensureUsername(id: string, name: string | null, email: string): Promise<string> {
  const base = handleFrom(name || email.split("@")[0]);
  for (let n = 0; n < 50; n++) {
    const candidate = n ? `${base.slice(0, 17)}${n + 1}` : base;
    const clash = await prisma.user.findFirst({ where: { username: candidate }, select: { id: true } });
    if (!clash) {
      await prisma.user.update({ where: { id }, data: { username: candidate } });
      return candidate;
    }
  }
  return base;
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, username: true, avatar: true } });
  if (!user) redirect("/");
  const username = user.username ?? (await ensureUsername(user.id, user.name, user.email));
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-6 py-10 sm:px-10">
      <h1 className="text-[2.4rem] leading-tight font-bold tracking-tight">Tu perfil</h1>
      <ProfileEditor name={user.name ?? user.email} username={username} initial={parseAvatar(user.avatar)} />
    </main>
  );
}
