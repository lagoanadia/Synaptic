"use client";

// Last resort, when even the app's frame fails to load: plain HTML, no app
// styles or navigation can be assumed here.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#37352f" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Synaptic no ha podido cargar</h1>
          <p style={{ fontSize: 14, color: "#6f6e69", maxWidth: 360, margin: 0 }}>Algo ha fallado al abrir la app. Tus apuntes están a salvo. Prueba a recargar en unos segundos.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ background: "#37352f", color: "#fff", border: 0, borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
              Recargar
            </button>
            <button type="button" onClick={reset} style={{ background: "transparent", color: "#6f6e69", border: 0, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
