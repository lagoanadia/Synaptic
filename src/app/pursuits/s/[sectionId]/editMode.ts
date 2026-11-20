"use client";

import { useSyncExternalStore } from "react";

// Whether the notebook page is in "edit" mode (the ✎ next to ⚙): shared by
// the header's pencil and the blocks, which show their add/move/remove
// controls only then. Not saved: every visit starts out of edit mode.
let on = false;
const listeners = new Set<() => void>();
export function setNotebookEditing(v: boolean) {
  on = v;
  listeners.forEach((l) => l());
}
export const useNotebookEditing = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => on,
    () => false,
  );
