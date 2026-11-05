import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type UploadPayload = { pursuitId: string; kind: "image" | "audio" | "slides" };

const ALLOWED_CONTENT_TYPES: Record<UploadPayload["kind"], string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  // Slide decks. A .pptx is a zip, and Blob sniffs real bytes, so it can come
  // back as application/zip.
  slides: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/pdf",
    "application/zip",
  ],
  // Browsers record different containers (Chrome webm, Safari mp4); Whisper
  // takes them all. Blob sniffs audio-only WebM as video/webm.
  audio: [
    "audio/webm",
    "video/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/mpeg",
    "audio/wav",
  ],
};

// Uploads go straight from the browser to Blob (Server Actions cap bodies at
// 1MB). This route only hands out a short-lived upload token.
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
        if (!pursuitId || !Object.hasOwn(ALLOWED_CONTENT_TYPES, kind)) {
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
