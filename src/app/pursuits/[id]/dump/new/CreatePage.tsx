"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createEmptyPage } from "../../actions";

// Made in the browser (not while the server renders the link's prefetch),
// so only a real click makes a page.
export function CreatePage({ pursuitId, sectionId }: { pursuitId: string; sectionId: string | null }) {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createEmptyPage(pursuitId, sectionId).then((id) => router.replace(`/pursuits/${pursuitId}/dump/${id}`));
  }, [pursuitId, sectionId, router]);
  return <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-9"><div className="h-10 w-48 animate-pulse rounded-md bg-chip" /></div>;
}
