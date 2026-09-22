import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPursuit, deletePursuit } from "./actions";
import { TypeSelect } from "./TypeSelect";
import { DeleteButton } from "./DeleteButton";

const TYPE_LABEL: Record<string, string> = {
  PROJECT: "Project",
  BOOK: "Book",
  LANGUAGE: "Language",
  SKILL: "Skill",
  OTHER: "Other",
};

function typeLabel(p: { type: string; customType: string | null }) {
  if (p.type === "OTHER" && p.customType) return p.customType;
  return TYPE_LABEL[p.type];
}

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
        <a href="/" className="text-sm text-ink-muted hover:underline">
          {session.user.name}
        </a>
      </div>

      <form action={createPursuit} className="flex gap-2">
        <input
          type="text"
          name="title"
          placeholder="New pursuit title"
          required
          className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-sm"
        />
        <TypeSelect />
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:opacity-90"
        >
          + New
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pursuits.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-lg border border-dashed border-border-subtle bg-white p-6 hover:border-solid hover:border-ink"
          >
            <a href={`/pursuits/${p.id}`} className="flex flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    p.status === "ACTIVE" ? "bg-accent" : "bg-ink-faint"
                  }`}
                />
                <span className="text-sm text-ink-muted">
                  {typeLabel(p)} · {p.status.toLowerCase()}
                </span>
              </div>
              <div className="text-lg font-semibold">{p.title}</div>
              {p.pursuitTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.pursuitTags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-ink-faint">
                last touched {timeAgo(p.lastTouchedAt)}
              </div>
            </a>
            {p.ownerId === session.user.id && (
              <DeleteButton
                action={deletePursuit.bind(null, p.id)}
                confirmMessage={`Delete "${p.title}"? This deletes everything inside it and can't be undone.`}
                className="self-start text-xs text-ink-faint hover:text-red-500"
              >
                Delete
              </DeleteButton>
            )}
          </div>
        ))}
        {pursuits.length === 0 && (
          <p className="text-sm text-ink-muted">
            No pursuits yet — create your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
