"use client";

import { useT } from "@/app/LangProvider";
// Last resort, when even the app's frame fails to load: plain HTML, no app
// styles or navigation can be assumed here.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#1c6fd1", color: "#fff" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 44, margin: 0, fontFamily: "Georgia, serif", fontWeight: 800 }}>{t("Se ha roto un hilo.")}</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.9)", maxWidth: 420, margin: 0 }}>{t("Algo ha fallado al abrir la app. Tus apuntes están a salvo. Prueba a recargar en unos segundos.")}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ background: "#fff", color: "#111", border: 0, borderRadius: 999, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Recargar
            </button>
            <button type="button" onClick={reset} style={{ background: "transparent", color: "rgba(255,255,255,.9)", border: 0, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
