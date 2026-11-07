import { ArrowLeft } from "@/app/icons";
import { BILLING } from "@/lib/billingFlag";
import Link from "next/link";

export const metadata = { title: "Política de privacidad", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:underline">
          <ArrowLeft /> Synaptic
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Política de privacidad</h1>
        <p className="mt-1 text-sm text-ink-faint">Última actualización: septiembre de 2026</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink">
        <p>
          Synaptic es un proyecto personal creado y gestionado por Nadia Lagoa Vilela,
          desde A Coruña (España). Esta página explica qué datos recoge Synaptic, para
          qué y qué puedes hacer al respecto. Dudas o peticiones:{" "}
          <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
            lagoanadia@gmail.com
          </a>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Qué recogemos</h2>
          <p>
            <strong>Datos de la cuenta</strong> — al iniciar sesión con GitHub o Google,
            recibimos de ellos tu nombre, tu email y tu foto de perfil. Nunca vemos ni
            guardamos tu contraseña de GitHub o Google.
          </p>
          <p>
            <strong>Lo que creas</strong> — notas en bruto (texto e imágenes pegadas o
            subidas), notas organizadas, tarjetas, grabaciones de voz y sus
            transcripciones, etiquetas, secciones y títulos de asignaturas. Es el
            contenido de la app — existe porque tú lo escribiste, pegaste o grabaste.
          </p>
          <p>
            <strong>Datos de uso</strong> — cuántas veces al día has usado una función
            de IA (Organizar, Preguntar, transcripción de voz), para aplicar el límite
            diario del plan gratis. No registramos visitas, clics ni comportamiento más
            allá de esto.
          </p>
          {BILLING && (
          <p>
            <strong>Datos de facturación</strong> — si te suscribes a un plan de pago,
            Stripe gestiona directamente los datos de tu tarjeta; nunca vemos ni
            guardamos su número. Solo guardamos tus identificadores de cliente y
            suscripción de Stripe y tu plan actual, para que la app sepa a qué tienes
            acceso.
          </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Quién más lo ve</h2>
          <p>No vendemos tus datos. Pasan por estos servicios para que la app funcione:</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li>
              <strong>GitHub / Google</strong> — para iniciar sesión (OAuth). Ven que
              entras en Synaptic; nosotros recibimos tu nombre, email y foto.
            </li>
            <li>
              <strong>Groq</strong> — el proveedor de IA detrás de Organizar, Preguntar,
              la creación de tarjetas y la transcripción de voz. Lo que le pides procesar
              se envía a la API de Groq para generar una respuesta; no se usa para
              entrenar sus modelos más allá de lo que digan sus propias condiciones de
              tratamiento de datos.
            </li>
          {BILLING && (
            <li>
              <strong>Stripe</strong> — procesa los pagos y gestiona las suscripciones de
              los planes de pago. Stripe tiene su propia política de privacidad para los
              datos de pago que gestiona directamente.
            </li>
          )}
            <li>
              <strong>Vercel</strong> — aloja la app y su base de datos. Los registros
              normales de infraestructura (dirección IP, fecha y hora) pasan por ellos al
              servir la web.
            </li>
          </ul>
          <p>
            Si compartes una asignatura con la cuenta de otra persona, esa persona puede
            ver su contenido (y editarlo, si le das acceso de edición) — eso es la
            función de compartir funcionando como debe, no un tercero.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Cookies</h2>
          <p>
            Synaptic usa una sola cookie: un token de sesión cifrado que mantiene tu
            sesión iniciada. Es estrictamente necesaria para que la app funcione y no se
            usa para seguimiento ni publicidad, así que no se muestra ningún aviso de
            cookies — no hay nada opcional que aceptar.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Cuánto tiempo lo guardamos</h2>
          <p>
            Tu contenido se guarda hasta que lo borres o cierres tu cuenta. Para borrar
            tu cuenta y todo lo que contiene, escribe a{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            — se hará en pocos días. Eliminar una asignatura dentro de la app borra su
            contenido al momento y para siempre.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Tus derechos</h2>
          <p>
            Si estás en la UE/EEE o en el Reino Unido, tienes derecho a acceder,
            corregir, exportar o borrar tus datos personales, y a oponerte a su
            tratamiento o limitarlo. Escribe a{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            para cualquiera de ellos — además, puedes exportar tú misma la mayor parte
            del contenido en Markdown desde la app (el enlace «Exportar» de cada
            asignatura).
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Transferencias internacionales</h2>
          <p>
            Groq, GitHub, Google, Stripe y Vercel operan a nivel mundial, así que tus
            datos pueden tratarse fuera de la UE/EEE (normalmente en EE. UU.) al usar
            sus servicios. Cada proveedor mantiene sus propias garantías para estas
            transferencias según sus condiciones.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Edad</h2>
          <p>
            Synaptic está pensada para estudiantes, pero no está dirigida a niños. No la
            uses si tienes menos de 16 años sin el consentimiento de tu madre, padre o
            tutor.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Cambios</h2>
          <p>
            Si esta política cambia de forma importante, cambiará la fecha de «Última
            actualización» de arriba y, si es algo relevante, lo diremos en la página de
            inicio.
          </p>
        </section>

        <p className="text-xs text-ink-faint">
          Esto es una descripción en lenguaje sencillo de las prácticas reales de un
          proyecto pequeño, escrita por su única desarrolladora — no sustituye la
          revisión de un abogado si dependes de ella para algo importante.
        </p>
      </div>
    </div>
  );
}
