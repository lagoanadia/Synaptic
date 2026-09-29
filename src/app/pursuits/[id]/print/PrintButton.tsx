"use client";

// A plain button instead of auto-calling window.print() on mount — some
// browsers block or delay a print dialog triggered without a direct user
// gesture, and an unexpected dialog popping up on page load is jarring
// anyway.
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
