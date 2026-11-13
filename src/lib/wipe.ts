import "server-only";
import { prisma } from "@/lib/prisma";

// Everything in a folder, then the folder (as one transaction's steps).
  // Children first: the foreign keys to Pursuit don't cascade.
export function wipePursuit(pursuitId: string) {
  return [
    prisma.flashcard.deleteMany({ where: { pursuitId } }),
    prisma.note.deleteMany({ where: { pursuitId } }),
    prisma.brainDump.deleteMany({ where: { pursuitId } }),
    // Has a plain (no-cascade) FK to Pursuit too — left out of this list,
    // any pursuit with a U1/U2-style content section failed to delete.
    prisma.pursuitContentSection.deleteMany({ where: { pursuitId } }),
    prisma.tag.deleteMany({ where: { pursuitId } }),
    prisma.attachment.deleteMany({ where: { pursuitId } }),
    prisma.pursuitMember.deleteMany({ where: { pursuitId } }),
    // ProjectCard cascades from Project, so deleting Project is enough.
    prisma.project.deleteMany({ where: { pursuitId } }),
    prisma.pursuit.delete({ where: { id: pursuitId } }),
  ];
}

// Your whole account: your folders (with everything in them), your pages in
// other people's folders, your memberships, notebooks and tags, then you.
// Logins, sessions and the rest cascade from the user.
export async function wipeUser(userId: string) {
  const owned = await prisma.pursuit.findMany({ where: { ownerId: userId }, select: { id: true } });
  await prisma.$transaction([
    ...owned.flatMap((p) => wipePursuit(p.id)),
    prisma.brainDump.deleteMany({ where: { authorId: userId } }),
    prisma.pursuitMember.deleteMany({ where: { userId } }),
    prisma.section.deleteMany({ where: { userId } }),
    prisma.pursuitTag.deleteMany({ where: { userId } }),
    prisma.organizeUsage.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
