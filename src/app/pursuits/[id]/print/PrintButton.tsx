"use client";

// A button, because browsers block print dialogs without a user gesture.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}
