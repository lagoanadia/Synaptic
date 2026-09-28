"use client";

import { useEffect, useState, useTransition } from "react";
import {
  disconnectClassroom,
  importClassroomFile,
  listClassroomCourses,
  listClassroomPdfs,
} from "./actions";
import type { ClassroomCourse, ClassroomFile } from "@/lib/googleClassroom";

// Not connected yet — a plain link into the OAuth flow (see
// api/classroom/connect), separate from however the user signed into
// Synaptic itself.
function ConnectButton({ pursuitId }: { pursuitId: string }) {
  return (
    <a
      href={`/api/classroom/connect?pursuitId=${pursuitId}`}
      className="self-start rounded-full border border-border-subtle bg-white px-4 py-2 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
    >
      Connect Google Classroom
    </a>
  );
}

export function ClassroomImport({
  pursuitId,
  connected,
}: {
  pursuitId: string;
  connected: boolean;
}) {
  const [courses, setCourses] = useState<ClassroomCourse[] | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [files, setFiles] = useState<ClassroomFile[] | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!connected) return;
    startTransition(async () => {
      const result = await listClassroomCourses();
      if (result.error) setError(result.error);
      else setCourses(result.courses ?? []);
    });
  }, [connected]);

  if (!connected) {
    return <ConnectButton pursuitId={pursuitId} />;
  }

  function pickCourse(courseId: string) {
    setSelectedCourse(courseId);
    setFiles(null);
    setError(null);
    if (!courseId) return;
    startTransition(async () => {
      const result = await listClassroomPdfs(courseId);
      if (result.error) setError(result.error);
      else setFiles(result.files ?? []);
    });
  }

  function importFile(file: ClassroomFile) {
    startTransition(async () => {
      await importClassroomFile(pursuitId, file.title, file.url);
      setImported((prev) => new Set(prev).add(file.url));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Google Classroom</span>
        <form action={disconnectClassroom}>
          <button type="submit" className="text-xs text-ink-faint hover:text-red-500">
            Disconnect
          </button>
        </form>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {courses === null ? (
        <p className="text-xs text-ink-muted">Loading your courses…</p>
      ) : courses.length === 0 ? (
        <p className="text-xs text-ink-muted">No active Classroom courses found.</p>
      ) : (
        <select
          value={selectedCourse}
          onChange={(e) => pickCourse(e.target.value)}
          className="rounded-md border border-border-subtle bg-white px-3 py-2 text-sm"
        >
          <option value="">Pick a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {files !== null && (
        <div className="flex flex-col">
          {files.length === 0 ? (
            <p className="text-xs text-ink-muted">No PDFs found in this course.</p>
          ) : (
            files.map((f) => (
              <div
                key={f.url}
                className="flex items-center justify-between gap-2 border-b border-dashed border-border-subtle py-2 last:border-0"
              >
                <span className="truncate text-sm">{f.title}</span>
                <button
                  type="button"
                  onClick={() => importFile(f)}
                  disabled={isPending || imported.has(f.url)}
                  className="shrink-0 rounded-full border border-ink px-3 py-1 text-xs font-medium hover:bg-chip disabled:opacity-50"
                >
                  {imported.has(f.url) ? "Added" : "+ Add"}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
