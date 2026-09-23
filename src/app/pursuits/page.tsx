import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPursuit, deletePursuit, deleteSection } from "./actions";
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

type PursuitForDisplay = {
  id: string;
  title: string;
  type: string;
  customType: string | null;
  status: string;
  lastTouchedAt: Date;
  ownerId: string;
  pursuitTags: { id: string; name: string }[];
};

function PursuitRow({
  label,
  pursuits,
  session,
}: {
  label: string;
  pursuits: PursuitForDisplay[];
  session: { user: { id: string } };
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {pursuits.map((p) => (
          <div
            key={p.id}
            className="flex w-56 flex-shrink-0 flex-col gap-3 rounded-lg border border-dashed border-border-subtle bg-white p-5 hover:border-solid hover:border-ink"
          >
            <a href={`/pursuits/${p.id}`} className="flex flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    p.status === "ACTIVE" ? "bg-accent" : "bg-ink-faint"
                  }`}
                />
                <span className="truncate text-xs text-ink-muted">
                  {typeLabel(p)} · {p.status.toLowerCase()}
                </span>
              </div>
              <div className="text-base font-semibold">{p.title}</div>
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
      </div>
    </div>
  );
}

export default async function PursuitsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuits, sections] = await Promise.all([
    prisma.pursuit.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      include: { pursuitTags: true, section: true },
      orderBy: { lastTouchedAt: "desc" },
    }),
    prisma.section.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  // Sections are free-typed and stored per user (see Section in the
  // schema) — grouped here from whichever pursuits already carry one,
  // rather than from a fixed preset list. Anything without a section
  // falls into its own row at the end instead of being hidden. A pursuit
  // someone else owns and shared with you carries THEIR section, not
  // yours — showing it under their private category name would be
  // confusing, so anything not owned by the viewer goes in its own
  // "Shared with me" row instead, regardless of its actual sectionId.
  const grouped = new Map<string, PursuitForDisplay[]>();
  const unsectioned: PursuitForDisplay[] = [];
  const shared: PursuitForDisplay[] = [];
  for (const p of pursuits) {
    if (p.ownerId !== session.user.id) {
      shared.push(p);
      continue;
    }
    const name = p.section?.name;
    if (!name) {
      unsectioned.push(p);
      continue;
    }
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(p);
  }
  const sectionRows = Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pursuits</h1>
        <a href="/" className="text-sm text-ink-muted hover:underline">
          {session.user.name}
        </a>
      </div>

      <form action={createPursuit} className="flex flex-wrap gap-2">
        <input
          type="text"
          name="title"
          placeholder="New pursuit title"
          required
          className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-sm"
        />
        <TypeSelect />
        <input
          type="text"
          name="section"
          list="pursuit-sections"
          placeholder="Section (optional)"
          className="rounded-md border border-border-subtle px-3 py-2 text-sm"
        />
        <datalist id="pursuit-sections">
          {sections.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:opacity-90"
        >
          + New
        </button>
      </form>

      {sections.length > 0 && (
        <div className="-mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-faint">Your sections</span>
          {sections.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1 rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
            >
              {s.name}
              <DeleteButton
                action={deleteSection.bind(null, s.id)}
                confirmMessage={`Delete section "${s.name}"? Pursuits in it become unsectioned — this can't be undone.`}
                className="text-ink-faint hover:text-red-500"
              >
                ×
              </DeleteButton>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {sectionRows.map(([name, rowPursuits]) => (
          <PursuitRow key={name} label={name} pursuits={rowPursuits} session={session} />
        ))}
        {shared.length > 0 && (
          <PursuitRow label="Shared with me" pursuits={shared} session={session} />
        )}
        {unsectioned.length > 0 && (
          <PursuitRow label="No section" pursuits={unsectioned} session={session} />
        )}
        {pursuits.length === 0 && (
          <p className="text-sm text-ink-muted">
            No pursuits yet — create your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
