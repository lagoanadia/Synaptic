import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPursuit } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  PROJECT: "Project",
  BOOK: "Book",
  LANGUAGE: "Language",
  SKILL: "Skill",
  OTHER: "Other",
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default async function PursuitsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const pursuits = await prisma.pursuit.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: { pursuitTags: true },
    orderBy: { lastTouchedAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pursuits</h1>
        <a href="/" className="text-sm text-zinc-500 hover:underline">
          {session.user.name}
        </a>
      </div>

      <form action={createPursuit} className="flex gap-2">
        <input
          type="text"
          name="title"
          placeholder="New pursuit title"
          required
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
        />
        <select
          name="type"
          defaultValue="PROJECT"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
        >
          <option value="PROJECT">Project</option>
          <option value="BOOK">Book</option>
          <option value="LANGUAGE">Language</option>
          <option value="SKILL">Skill</option>
          <option value="OTHER">Other</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pursuits.map((p) => (
          <a
            key={p.id}
            href={`/pursuits/${p.id}`}
            className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-6 hover:border-solid hover:border-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:hover:border-zinc-50"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  p.status === "ACTIVE" ? "bg-blue-500" : "bg-zinc-400"
                }`}
              />
              <span className="font-mono text-xs tracking-wide text-zinc-500 uppercase">
                {TYPE_LABEL[p.type]} · {p.status.toLowerCase()}
              </span>
            </div>
            <div className="text-lg font-semibold">{p.title}</div>
            {p.pursuitTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.pursuitTags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-zinc-300 px-2 py-0.5 font-mono text-[10px] text-zinc-500 uppercase dark:border-zinc-700"
                  >
                    #{t.name}
                  </span>
                ))}
              </div>
            )}
            <div className="font-mono text-xs text-zinc-500">
              last touched {timeAgo(p.lastTouchedAt)}
            </div>
          </a>
        ))}
        {pursuits.length === 0 && (
          <p className="text-sm text-zinc-500">
            No pursuits yet — create your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
