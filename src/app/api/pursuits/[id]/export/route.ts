import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildPursuitMarkdown } from "@/lib/export";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pursuit"
  );
}

// A file download, not a page — that's what makes this a Route Handler
// (route.ts) instead of a page.tsx: we need to set real HTTP response
// headers (Content-Disposition) rather than render a component tree.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Not signed in", { status: 401 });
  }

  // Same owner-or-member guard as every pursuit action — a download link
  // is still access to pursuit content.
  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      notes: {
        include: { tags: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      brainDumps: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!pursuit) {
    return new NextResponse("Not found", { status: 404 });
  }

  const markdown = buildPursuitMarkdown({
    title: pursuit.title,
    notes: pursuit.notes,
    dumps: pursuit.brainDumps,
  });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(pursuit.title)}.md"`,
    },
  });
}
