import { getT } from "@/lib/i18n/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { boardSvg, cleanShapes } from "@/lib/whiteboard";

// A page's whiteboard as an SVG image (what the page, print and PDF show).
// ?json=1 gives its shapes for the editor. Only for people in its folder.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(t("No has iniciado sesión"), { status: 401 });
  const board = await prisma.whiteboard.findFirst({
    where: { id, pursuit: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } },
    select: { data: true },
  });
  if (!board) return new Response(t("No encontrada"), { status: 404 });
  const shapes = cleanShapes(board.data);
  if (new URL(req.url).searchParams.get("json")) return Response.json(shapes, { headers: { "cache-control": "no-store" } });
  return new Response(boardSvg(shapes), {
    headers: { "content-type": "image/svg+xml", "cache-control": "private, no-cache", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
