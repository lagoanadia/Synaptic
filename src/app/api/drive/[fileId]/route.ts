import { auth } from "@/auth";
import { getValidAccessToken } from "@/lib/googleClassroom";

// A class file from Google Drive as a PDF, so the slide panel can draw it
// with selectable text. Google Slides/Docs are exported to PDF; PDFs pass
// through. Uses the Classroom connection's Drive (read-only) access.
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });
  const { fileId } = await params;
  if (!/^[\w-]{10,200}$/.test(fileId)) return new Response("bad id", { status: 400 });
  const token = await getValidAccessToken(session.user.id);
  if (!token) return new Response("not connected", { status: 403 });
  const headers = { Authorization: `Bearer ${token}` };
  const api = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const meta = await fetch(`${api}?fields=mimeType,size&supportsAllDrives=true`, { headers });
  if (!meta.ok) return new Response("no access", { status: meta.status === 404 ? 404 : 403 });
  const { mimeType, size } = (await meta.json()) as { mimeType?: string; size?: string };
  let file: Response;
  if (mimeType?.startsWith("application/vnd.google-apps.")) {
    file = await fetch(`${api}/export?mimeType=application/pdf`, { headers });
  } else if (mimeType === "application/pdf") {
    if (Number(size ?? 0) > 60_000_000) return new Response("too big", { status: 413 });
    file = await fetch(`${api}?alt=media&supportsAllDrives=true`, { headers });
  } else {
    return new Response("not a pdf", { status: 415 });
  }
  if (!file.ok || !file.body) return new Response("download failed", { status: 502 });
  return new Response(file.body, { headers: { "content-type": "application/pdf", "cache-control": "private, max-age=600" } });
}
