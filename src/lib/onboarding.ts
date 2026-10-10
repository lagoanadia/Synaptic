import { prisma } from "@/lib/prisma";

const EXAMPLE_DUMP = `Clase de hoy: la mitocondria es la "central energética" de la célula.
Produce ATP a partir de glucosa y oxígeno (respiración celular).
Tiene su propio ADN, separado del núcleo — por eso se cree que antes era una bacteria independiente (teoría endosimbiótica).
Pregunta del profesor: ¿por qué las células musculares tienen más mitocondrias que otras? -> porque gastan más energía.`;

const EXAMPLE_NOTE = `# La mitocondria

1. Es la "central energética" de la célula: produce ATP a partir de glucosa y oxígeno mediante la respiración celular.
2. Tiene su propio ADN, separado del núcleo.
   a. Por eso se cree que antes era una bacteria independiente — la teoría endosimbiótica.
3. Las células que gastan más energía (como las musculares) tienen más mitocondrias.`;

// Runs once per new account (see the createUser event in src/auth.ts) so
// every new user has something real to open instead of an empty list —
// the onboarding tour's second stage points at this Pursuit's Brain Dump
// tab. Deliberately NOT idempotent beyond that single call site: there's
// no "recreate the example" path, same as GitHub's own sample repo on a
// new account.
export async function seedWelcomePursuit(userId: string) {
  const pursuit = await prisma.pursuit.create({
    data: {
      title: "👋 Bienvenida a Synaptic",
      type: "Guía",
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
