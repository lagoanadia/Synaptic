import { prisma } from "@/lib/prisma";

// Always in English, same as every other string in the app's own JSX —
// unlike the onboarding tour's own popup text (see src/lib/i18n.ts), this
// seeded content isn't translated per-user: it's a one-off example, and
// there's no reliable locale signal yet at the moment a brand-new account
// is created (see the createUser event in src/auth.ts) to pick one even
// if it were.
const EXAMPLE_DUMP = `Today's class: the mitochondria is the cell's "power plant".
It produces ATP from glucose and oxygen (cellular respiration).
It has its own DNA, separate from the nucleus — that's why it's thought to have once been an independent bacterium (the endosymbiotic theory).
Teacher's question: why do muscle cells have more mitochondria than other cells? -> because they use more energy.`;

const EXAMPLE_NOTE = `# The mitochondria

1. It's the cell's "power plant": it produces ATP from glucose and oxygen through cellular respiration.
2. It has its own DNA, separate from the nucleus.
   a. That's why it's thought to have once been an independent bacterium — the endosymbiotic theory.
3. Cells that use more energy (like muscle cells) have more mitochondria.`;

// Runs once per new account (see the createUser event in src/auth.ts) so
// every new user has something real to open instead of an empty list —
// the onboarding tour's second stage points at this Pursuit's Brain Dump
// tab. Deliberately NOT idempotent beyond that single call site: there's
// no "recreate the example" path, same as GitHub's own sample repo on a
// new account.
export async function seedWelcomePursuit(userId: string) {
  const pursuit = await prisma.pursuit.create({
    data: {
      title: "👋 Welcome to Synaptic",
      type: "Guide",
      ownerId: userId,
    },
  });

  const dump = await prisma.brainDump.create({
    data: {
      pursuitId: pursuit.id,
      authorId: userId,
      content: EXAMPLE_DUMP,
      processed: true,
    },
  });

  await prisma.note.create({
    data: {
      pursuitId: pursuit.id,
      content: EXAMPLE_NOTE,
      sourceDumps: { connect: { id: dump.id } },
    },
  });
}
