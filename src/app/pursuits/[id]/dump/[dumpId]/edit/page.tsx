import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NewDumpForm } from "../../new/NewDumpForm";

export default async function EditDumpPage({
  params,
}: {
  params: Promise<{ id: string; dumpId: string }>;
}) {
  const { id, dumpId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const dump = await prisma.brainDump.findFirst({
    where: {
      id: dumpId,
      pursuitId: id,
      pursuit: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    },
    include: { pursuit: { select: { title: true } } },
  });

  if (!dump) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-9">
      <Link
        href={`/pursuits/${id}/dump/${dumpId}`}
        className="text-sm text-ink-muted hover:underline"
      >
        ← {dump.pursuit.title}
      </Link>
      <NewDumpForm
        pursuitId={id}
        dumpId={dump.id}
        initialContent={dump.content ?? ""}
      />
    </div>
  );
}
