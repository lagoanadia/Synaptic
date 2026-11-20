import { upload } from "@vercel/blob/client";

// Files go straight from the browser to Blob storage: a Server Action's
// request body is capped at 1MB, which a phone photo blows past.
export async function uploadToBlob(pursuitId: string, file: File | Blob, name: string, kind: "image" | "audio" | "slides") {
  const blob = await upload(`${kind === "slides" ? "slides" : "dumps"}/${pursuitId}/${name}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
    clientPayload: JSON.stringify({ pursuitId, kind }),
  });
  return blob.url;
}
