import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Brain Dump images upload straight from the browser to Blob storage
// instead of going through a Server Action — Next.js caps a Server
// Action's request body at 1MB, which a phone photo blows past easily.
// This route only hands out a short-lived upload token; the file itself
// never passes through our server.
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

        const pursuitId = clientPayload;
        if (!pursuitId) {
          throw new Error("Missing pursuit");
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
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
          ],
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
