import { getT } from "@/lib/i18n/server";
import { ArrowLeft } from "@/app/icons";
import { BILLING } from "@/lib/billingFlag";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Términos del servicio"), alternates: { canonical: "/terms" }  };
}

export default async function Terms() {
  const t = await getT();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:underline">
          <ArrowLeft /> Synaptic
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("Términos del servicio")}</h1>
        <p className="mt-1 text-sm text-ink-faint">{t("Última actualización: septiembre de 2026")}</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink">
        <p>
          
          {t("Synaptic es un proyecto personal de Nadia Lagoa Vilela. Al crear una cuenta aceptas estos términos. Dudas:")}{" "}
          <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
            lagoanadia@gmail.com
          </a>
          . Consulta también la{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            
            {t("Política de privacidad")}
          </Link>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("El servicio")}</h2>
          <p>
            
            {t("Synaptic te permite apuntar notas, organizarlas con IA y repasarlas con tarjetas y un asistente de IA que responde a partir de tus propias notas. Lo lleva una sola persona como proyecto personal, no una empresa con un equipo de soporte — tenlo en cuenta.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Tu cuenta")}</h2>
          <p>
            
            {t("Inicias sesión con una cuenta de GitHub o Google y eres responsable de mantenerla segura. También eres responsable de lo que se publique o suba desde tu cuenta.")}
          </p>
        </section>

        {BILLING && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Planes y facturación")}</h2>
          <p>
            
            {t("Los límites del plan gratis (tarjetas al mes, usos diarios de la IA, personas por asignatura) se indican en la página de precios y pueden cambiar con aviso. Los planes de pago (Student Pro, Team) se renuevan cada mes y se cobran a través de Stripe; puedes cancelar cuando quieras desde Facturación → Gestionar facturación, lo que detiene la siguiente renovación — mantienes el acceso el resto del periodo que ya pagaste.")}
          </p>
          <p>
            
            {t("Si estás en la UE/EEE o en el Reino Unido, tienes 14 días de derecho de desistimiento en una suscripción de pago nueva, con reembolso completo, desde el día en que te suscribes — escribe a")}{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            
            {t("para ejercerlo. Fuera de ese plazo, los pagos ya hechos no se reembolsan por meses parciales.")}
          </p>
        </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Tu contenido")}</h2>
          <p>
            
            {t("Todo lo que apuntas, organizas o generas en Synaptic es tuyo. No reclamamos su propiedad — solo lo guardamos y lo procesamos (incluido enviarlo a los modelos de IA de Groq) para que funcione la app. No subas nada que no tengas derecho a guardar o compartir, y no uses la app para guardar o generar nada ilegal, abusivo o que infrinja derechos.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Funciones de IA")}</h2>
          <p>
            
            {t("Organizar, Preguntar y la creación de tarjetas usan un modelo de IA de terceros (Groq) y pueden equivocarse, perder contexto o leer mal notas desordenadas o escritas a mano. Trata lo que genera la IA como un borrador que revisar, no como un hecho comprobado, sobre todo antes de usarlo en trabajos con nota.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Compartir asignaturas")}</h2>
          <p>
            
            {t("Si invitas a alguien a una asignatura, podrá ver su contenido (y editarlo, si le das acceso de edición). Eres responsable de compartir solo con quien de verdad quieras que lo vea.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Sin garantía y responsabilidad limitada")}</h2>
          <p>
            
            {t("Synaptic se ofrece tal cual, sin garantía de disponibilidad — es el proyecto personal de una persona en un hosting normal, no un servicio con un acuerdo de nivel de servicio. En la medida en que la ley lo permita, Synaptic y su desarrolladora no se hacen responsables de datos perdidos, trabajos perdidos ni daños indirectos por usar o no poder usar la app. Exporta lo importante (el enlace «Exportar») si te molestaría perderlo.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Cerrar tu cuenta")}</h2>
          <p>
            
            {t("Puedes dejar de usar Synaptic cuando quieras y pedir que se borre tu cuenta (ver la Política de privacidad). También podemos suspender o cerrar una cuenta que abuse del servicio o de estos términos.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("Cambios en estos términos")}</h2>
          <p>
            
            {t("Si estos términos cambian de forma importante, lo indicaremos en la página de inicio junto con la nueva fecha de arriba.")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Ley aplicable</h2>
          <p>{t("Estos términos se rigen por la ley española.")}</p>
        </section>
      </div>
    </div>
  );
}
