import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreatePage } from "./CreatePage";

// "Nueva página": made right away and opened in the page editor, so a new
// page looks and works exactly like a saved one.
export default async function NewDumpPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const { id } = await params;
  const { section } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const pursuit = await prisma.pursuit.findFirst({
    where: { id, OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
    select: { id: true },
  });
  if (!pursuit) notFound();
  return <CreatePage pursuitId={pursuit.id} sectionId={section ?? null} />;
}
