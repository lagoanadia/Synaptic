"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { pdfToImagePages } from "@/lib/pdfToImages";
import {
  createProjectCard,
  deleteProjectCard,
  proposeProjectCards,
  reorderProjectCards,
  updateProjectCard,
  updateProjectDueDate,
} from "../../actions";
import { DeleteButton } from "../../../DeleteButton";

type Status = "TODO" | "IN_PROGRESS" | "DONE";

type CardForDisplay = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  order: number;
};

const COLUMNS: { key: Status; label: string }[] = [
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
];

// Same "whole-column resync" idiom as DumpControls' withDraggedInsertedAt —
// remove the dragged card from wherever it was, splice it back in right
// before/after targetId, return the resulting id list for reorderProjectCards
// to write in one trip.
function withDraggedInsertedAt(
  list: CardForDisplay[],
  draggedId: string,
  targetId: string,
  insertAfter: boolean,
): string[] {
  const ids = list.filter((c) => c.id !== draggedId).map((c) => c.id);
  const targetIndex = ids.indexOf(targetId);
  const insertAt = insertAfter ? targetIndex + 1 : targetIndex;
  ids.splice(insertAt, 0, draggedId);
  return ids;
}

function Card({
  pursuitId,
  projectId,
  card,
  isDragging,
  isPending,
  startTransition,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: {
  pursuitId: string;
  projectId: string;
  card: CardForDisplay;
  isDragging: boolean;
  isPending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOverCard: (e: React.DragEvent) => void;
  onDropOnCard: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  function save() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed === "" ) {
      setTitle(card.title);
      return;
    }
    if (trimmed === card.title && description === (card.description ?? "")) return;
    startTransition(() =>
      updateProjectCard(pursuitId, projectId, card.id, {
        title: trimmed,
        description: description.trim() === "" ? null : description,
      }),
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      onDrop={onDropOnCard}
      className={`group flex cursor-grab flex-col gap-1.5 rounded-xl border border-border-subtle bg-white p-3 text-sm transition-colors active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {editing ? (
        <>
          <input
            autoFocus
            value={title}
            disabled={isPending}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={save}
            className="w-full rounded-md border border-border-subtle px-2 py-1 text-sm font-medium outline-none disabled:opacity-50"
          />
          <textarea
            value={description}
            disabled={isPending}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={save}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-none rounded-md border border-border-subtle px-2 py-1 text-xs text-ink-muted outline-none disabled:opacity-50"
          />
        </>
      ) : (
        <div className="flex items-start justify-between gap-2" onClick={() => setEditing(true)}>
          <div className="flex-1">
            <p className="font-medium text-ink">{card.title}</p>
            {card.description && (
              <p className="mt-0.5 text-xs whitespace-pre-wrap text-ink-muted">
                {card.description}
              </p>
            )}
          </div>
          <DeleteButton
            action={deleteProjectCard.bind(null, pursuitId, projectId, card.id)}
            className="text-ink-faint opacity-0 hover:text-red-500 group-hover:opacity-100"
          >
            ×
          </DeleteButton>
        </div>
      )}
    </div>
  );
}

function AddCardForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="self-start text-xs text-ink-faint hover:text-ink"
      >
        + Add card
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const title = ref.current?.value.trim();
        if (title) onAdd(title);
        if (ref.current) ref.current.value = "";
      }}
    >
      <input
        ref={ref}
        autoFocus
        type="text"
        placeholder="Card title"
        onBlur={() => setAdding(false)}
        className="w-full rounded-md border border-border-subtle bg-white px-2.5 py-1.5 text-sm outline-none"
      />
    </form>
  );
}

export function ProjectBoard({
  pursuitId,
  project,
  cards,
}: {
  pursuitId: string;
  project: { id: string; title: string; dueDate: string | null };
  cards: CardForDisplay[];
}) {
  const projectId = project.id;
  const [isPending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(
    null,
  );
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const byStatus = (status: Status) =>
    cards.filter((c) => c.status === status).sort((a, b) => a.order - b.order);

  const total = cards.length;
  const done = cards.filter((c) => c.status === "DONE").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function clearDrag() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleColumnDrop(status: Status, list: CardForDisplay[], e: React.DragEvent) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    clearDrag();
    if (!draggedId) return;
    const ids = [...list.filter((c) => c.id !== draggedId).map((c) => c.id), draggedId];
    startTransition(() => reorderProjectCards(pursuitId, projectId, status, ids));
  }

  function handleCardDrop(status: Status, list: CardForDisplay[], targetId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    const insertAfter = dropTarget?.id === targetId ? dropTarget.position === "after" : false;
    clearDrag();
    if (!draggedId || draggedId === targetId) return;
    const ids = withDraggedInsertedAt(list, draggedId, targetId, insertAfter);
    startTransition(() => reorderProjectCards(pursuitId, projectId, status, ids));
  }

  async function handleEnunciadoFile(file: File) {
    setUploadError(null);
    setIsUploading(true);
    try {
      const isPdf = file.type === "application/pdf";
      const urls: string[] = [];
      if (isPdf) {
        const pages = await pdfToImagePages(file);
        for (let i = 0; i < pages.length; i++) {
          setUploadStatus(`Uploading page ${i + 1} of ${pages.length}…`);
          const pageFile = new File([pages[i]], `${file.name}-page-${i + 1}.jpg`, {
            type: "image/jpeg",
          });
          const blob = await upload(`projects/${projectId}/${pageFile.name}`, pageFile, {
            access: "public",
            handleUploadUrl: "/api/blob-upload",
            clientPayload: JSON.stringify({ pursuitId, kind: "image" }),
          });
          urls.push(blob.url);
        }
      } else {
        setUploadStatus("Uploading…");
        const blob = await upload(`projects/${projectId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          clientPayload: JSON.stringify({ pursuitId, kind: "image" }),
        });
        urls.push(blob.url);
      }

      setUploadStatus("Reading the assignment…");
      const result = await proposeProjectCards(pursuitId, projectId, urls);
      if (result.error) setUploadError(result.error);
    } catch {
      setUploadError("Couldn't read that file — try again");
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold text-ink">{project.title}</h1>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-ink-faint">
              {done}/{total} done · {pct}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              startTransition(() =>
                updateProjectDueDate(pursuitId, projectId, e.target.value || null),
              );
            }}
            title="Due date"
            className="rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleEnunciadoFile(file);
            }}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-accent px-3.5 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            {isUploading ? (uploadStatus ?? "Uploading…") : "📄 Upload assignment → propose cards"}
          </button>
        </div>
      </div>
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map(({ key, label }) => {
          const list = byStatus(key);
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleColumnDrop(key, list, e)}
              className="flex flex-col gap-2 rounded-2xl bg-callout p-3"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-ink-muted">{label}</p>
                <span className="text-xs text-ink-faint">{list.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((card) => (
                  <Card
                    key={card.id}
                    pursuitId={pursuitId}
                    projectId={projectId}
                    card={card}
                    isDragging={draggingId === card.id}
                    isPending={isPending}
                    startTransition={startTransition}
                    onDragStart={(e) => {
                      setDraggingId(card.id);
                      e.dataTransfer.setData("text/plain", card.id);
                    }}
                    onDragEnd={clearDrag}
                    onDragOverCard={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
                      setDropTarget({ id: card.id, position });
                    }}
                    onDropOnCard={(e) => handleCardDrop(key, list, card.id, e)}
                  />
                ))}
              </div>
              <AddCardForm
                onAdd={(title) => startTransition(() => createProjectCard(pursuitId, projectId, key, title))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
