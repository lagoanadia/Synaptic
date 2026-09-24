import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type UploadPayload = { pursuitId: string; kind: "image" | "audio" };

const ALLOWED_CONTENT_TYPES: Record<UploadPayload["kind"], string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  // Whatever MediaRecorder actually produces varies by browser (Chrome/
  // Firefox: webm; Safari: mp4) — Groq's Whisper endpoint accepts all of
  // these anyway, so there's no need to pin it down to one.
  audio: ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"],
};

// Brain Dump images (and now voice note recordings) upload straight from
// the browser to Blob storage instead of going through a Server Action —
// Next.js caps a Server Action's request body at 1MB, which a phone photo
// or a voice recording both blow past easily. This route only hands out a
// short-lived upload token; the file itself never passes through our
// server.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("Not signed in");
        }

        if (!clientPayload) {
          throw new Error("Missing upload details");
        }
        const { pursuitId, kind }: UploadPayload = JSON.parse(clientPayload);
        if (!pursuitId || (kind !== "image" && kind !== "audio")) {
          throw new Error("Missing upload details");
        }

        const pursuit = await prisma.pursuit.findFirst({
          where: {
            id: pursuitId,
            OR: [
              { ownerId: session.user.id },
              { members: { some: { userId: session.user.id } } },
            ],
          },
        });
        if (!pursuit) {
          throw new Error("Pursuit not found or access denied");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES[kind],
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Vercel calls this as a webhook once the upload finishes; we don't
        // need to do anything with it since the client inserts the URL
        // into the dump content itself once `upload()` resolves.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
