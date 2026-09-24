import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPursuit, deleteSection, reorderSection } from "./actions";
import { TypeSelect } from "./TypeSelect";
import { DeleteButton } from "./DeleteButton";
import { PursuitsBoard, type PursuitForDisplay } from "./PursuitsBoard";

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
      orderBy: { order: "asc" },
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
    const display: PursuitForDisplay = {
      id: p.id,
      title: p.title,
      type: p.type,
      customType: p.customType,
      status: p.status,
      timeAgoLabel: timeAgo(p.lastTouchedAt),
      ownerId: p.ownerId,
      pursuitTags: p.pursuitTags,
    };
    if (p.ownerId !== session.user.id) {
      shared.push(display);
      continue;
    }
    const name = p.section?.name;
    if (!name) {
      unsectioned.push(display);
      continue;
    }
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(display);
  }
  // Rows follow each section's stored `order` (see reorderSection) instead
  // of alphabetical, so dragging — well, clicking ↑/↓ — actually sticks.
  const sectionRows: [string, PursuitForDisplay[]][] = sections
    .filter((s) => grouped.has(s.name))
    .map((s) => [s.name, grouped.get(s.name)!]);

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
          {sections.map((s, i) => (
            <span
              key={s.id}
              className="flex items-center gap-1 rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
            >
              <form action={reorderSection.bind(null, s.id, "up")}>
                <button
                  type="submit"
                  disabled={i === 0}
                  title="Move row up"
                  className="text-ink-faint hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
              </form>
              <form action={reorderSection.bind(null, s.id, "down")}>
                <button
                  type="submit"
                  disabled={i === sections.length - 1}
                  title="Move row down"
                  className="text-ink-faint hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
              </form>
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

      <PursuitsBoard
        sectionRows={sectionRows}
        shared={shared}
        unsectioned={unsectioned}
        sectionNames={sections.map((s) => s.name)}
        viewerId={session.user.id}
      />
    </div>
  );
}
