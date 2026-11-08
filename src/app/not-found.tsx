import Link from "next/link";
import { BrokenThread, errorButton } from "./BrokenThread";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <BrokenThread title="Esta página no está en el mapa." text="Puede que se haya movido o que nunca existiera.">
      <Link href="/" className={errorButton}>
        ← Volver al inicio
      </Link>
    </BrokenThread>
  );
}
