import { ArrowRight, CheckIcon } from "@/app/icons";
import { HeroCards } from "./HeroCards";
import { Reveal } from "./Reveal";
import { AuthMenu } from "./AuthMenu";

const tileBase =
  "rounded-[20px] p-7 transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]";

export function Landing() {
  return (
    <main>
      {/* ---------- hero ---------- */}
      <section className="mx-auto max-w-[1000px] px-6 pb-10 pt-[clamp(60px,10vw,110px)] text-center">
        <Reveal>
          <h1 className="text-[clamp(2rem,5.5vw,3.4rem)] font-extrabold leading-[1.15] tracking-tight text-[#0d0d0d]">
            Un lugar para que tus{" "}
            <span className="whitespace-nowrap rounded-[10px] bg-accent-soft px-2.5 text-accent">
              notas en bruto
            </span>{" "}
            se conviertan en{" "}
            <span className="whitespace-nowrap rounded-[10px] bg-[#fdefe0] px-2.5 text-[#b5502e]">
              conocimiento real
            </span>
            .
          </h1>
        </Reveal>
        <Reveal delayMs={90}>
          <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-relaxed text-[#6b6b6b]">
            <strong className="text-[#0d0d0d]">Synaptic</strong> es una app para estudiantes:
            apunta en texto, imágenes o voz, deja que la IA lo organice, crea
            tarjetas y pregunta sobre tu propio material — todo en un sitio.
          </p>
        </Reveal>
        <Reveal delayMs={180}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <AuthMenu triggerClassName="rounded-full bg-[#0d0d0d] px-7 py-3.5 text-[0.95rem] font-semibold text-white transition-transform hover:-translate-y-1 hover:shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]">
              Únete gratis
            </AuthMenu>
            <a href="#features" className="font-semibold transition-colors hover:text-accent">
              Saber más <ArrowRight />
            </a>
          </div>
        </Reveal>

        <HeroCards />
      </section>

      {/* ---------- features (bento) ---------- */}
      <section id="features" className="bg-[#0d0d0d] px-6 py-[clamp(60px,8vw,100px)] text-white sm:px-8">
        <Reveal>
          <div className="mx-auto mb-9 flex max-w-6xl flex-wrap items-end justify-between gap-6">
            <h2 className="text-[clamp(1.7rem,3.6vw,2.5rem)] font-extrabold leading-tight">
              Todo lo que necesitas para
              <br />
              recordarlo de verdad
            </h2>
            <p className="max-w-[260px] text-white/55">
              Cinco herramientas que convierten notas sueltas en conocimiento real.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Reveal delayMs={0} className="lg:row-span-2">
            <div className={`${tileBase} flex h-full min-h-[340px] flex-col justify-end bg-[#0f3d2e]`}>
              <span className="text-xs font-bold tracking-wide opacity-75">01 — NOTAS EN BRUTO</span>
              <p className="mt-2.5 text-[1.3rem] font-bold">Organizadas por IA, automáticamente</p>
              <p className="mt-2 text-sm opacity-85">
                Escribe sin orden. Convertimos el caos en notas limpias y estructuradas.
              </p>
            </div>
          </Reveal>
          <Reveal delayMs={90}>
            <div className={`${tileBase} bg-[#ebda3c] text-[#0d0d0d]`}>
              <span className="text-xs font-bold tracking-wide opacity-75">02 — TARJETAS</span>
              <p className="mt-2.5 text-[1.3rem] font-bold">Tarjetas al instante de cualquier nota</p>
            </div>
          </Reveal>
          <Reveal delayMs={180}>
            <div className={`${tileBase} bg-[#b5502e]`}>
              <span className="text-xs font-bold tracking-wide opacity-75">03 — PREGUNTAR</span>
              <p className="mt-2.5 text-[1.3rem] font-bold">Chatea con tus propias notas</p>
            </div>
          </Reveal>
          <Reveal delayMs={270}>
            <div className={`${tileBase} bg-[#1f1f1f]`}>
              <span className="text-xs font-bold tracking-wide opacity-75">04 — SECCIONES</span>
              <p className="mt-2.5 text-[1.3rem] font-bold">Ordenadas por clase o tema</p>
            </div>
          </Reveal>
          <Reveal delayMs={360}>
            <div className={`${tileBase} bg-[#1f1f1f]`}>
              <span className="text-xs font-bold tracking-wide opacity-75">05 — COMPARTIR</span>
              <p className="mt-2.5 text-[1.3rem] font-bold">Un enlace para invitar a compañeros</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="bg-[#f7f6f3] px-6 py-[clamp(60px,8vw,100px)] text-center">
        <Reveal>
          <h2 className="mb-10 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold">Cómo funciona</h2>
        </Reveal>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { n: "1", color: "#0f3d2e", title: "Apunta", desc: "Apunta todo en clase, sin estructura." },
            { n: "2", color: "#b5502e", title: "Organiza", desc: "La IA ordena, etiqueta y archiva tus notas en secciones." },
            { n: "3", color: "#a3821f", title: "Recuerda", desc: "Haz preguntas, crea tarjetas y estudia mejor." },
          ].map((step, i) => (
            <Reveal key={step.n} delayMs={i * 90}>
              <div className="rounded-[20px] bg-white p-8 text-left shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)]">
                <span className="text-[1.8rem] font-extrabold" style={{ color: step.color }}>
                  {step.n}
                </span>
                <p className="mt-2.5 text-[1.15rem] font-bold">{step.title}</p>
                <p className="mt-1.5 text-sm text-[#6b6b6b]">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="px-6 py-[clamp(60px,8vw,100px)] text-center">
        <Reveal>
          <h2 className="mb-11 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold">
            Precios que encajan con tu curso
          </h2>
        </Reveal>
        <div className="mx-auto grid max-w-[1000px] grid-cols-1 items-center gap-6 sm:grid-cols-3">
          <Reveal delayMs={0}>
            <div className="rounded-[20px] bg-white p-8 text-left shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-transform duration-300 hover:-translate-y-2">
              <p className="font-bold">Gratis</p>
              <p className="mt-2 mb-5 text-[2.4rem] font-extrabold">$0</p>
              <ul className="mb-7 flex flex-col gap-2.5 text-sm">
                {["Notas ilimitadas", "Organización con IA", "10 tarjetas/mes"].map((f) => (
                  <li key={f} className="relative pl-5 opacity-85">
                    <span className="absolute left-0 font-bold text-accent"><CheckIcon size={14} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <AuthMenu
                block
                align="center"
                triggerClassName="block w-full rounded-full border-[1.5px] border-[#0d0d0d] py-3.5 text-center text-sm font-semibold transition-colors hover:bg-[#0d0d0d] hover:text-white"
              >
                Empieza gratis
              </AuthMenu>
            </div>
          </Reveal>

          <Reveal delayMs={90}>
            <div className="relative rounded-[20px] bg-[#0d0d0d] p-8 text-left text-white shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)] transition-transform duration-300 hover:-translate-y-2 sm:scale-[1.06]">
              <span className="absolute -top-3.5 right-6 rounded-full bg-[#ebda3c] px-3.5 py-1.5 text-[0.7rem] font-extrabold text-[#0d0d0d]">
                EL FAVORITO
              </span>
              <p className="font-bold">Student Pro</p>
              <p className="mt-2 mb-5 text-[2.4rem] font-extrabold">
                $6<span className="text-base font-medium opacity-60">/mes</span>
              </p>
              <ul className="mb-7 flex flex-col gap-2.5 text-sm">
                {["Tarjetas ilimitadas", "Pregunta a tus notas (IA)", "Compartir sin límite"].map((f) => (
                  <li key={f} className="relative pl-5 opacity-85">
                    <span className="absolute left-0 font-bold text-[#ebda3c]"><CheckIcon size={14} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/billing"
                className="block w-full rounded-full bg-white py-3.5 text-center text-sm font-semibold text-accent transition-transform hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(13,13,13,0.3)]"
              >
                Hazte Pro
              </a>
            </div>
          </Reveal>

          <Reveal delayMs={180}>
            <div className="rounded-[20px] bg-white p-8 text-left shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-transform duration-300 hover:-translate-y-2">
              <p className="font-bold">Team</p>
              <p className="mt-2 mb-5 text-[2.4rem] font-extrabold">
                $10<span className="text-base font-medium opacity-60">/mes</span>
              </p>
              <ul className="mb-7 flex flex-col gap-2.5 text-sm">
                {["Secciones compartidas", "Espacios para grupos de estudio", "Soporte prioritario"].map((f) => (
                  <li key={f} className="relative pl-5 opacity-85">
                    <span className="absolute left-0 font-bold text-[#b5502e]"><CheckIcon size={14} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/billing"
                className="block w-full rounded-full border-[1.5px] border-[#0d0d0d] py-3.5 text-center text-sm font-semibold transition-colors hover:bg-[#0d0d0d] hover:text-white"
              >
                Elegir Team
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA banner ---------- */}
      <Reveal className="block px-6">
        <section className="mx-auto mb-20 flex max-w-6xl flex-wrap items-center justify-between gap-8 rounded-[28px] bg-accent p-[clamp(32px,6vw,60px)] text-accent-fg shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]">
          <div className="text-center sm:text-left">
            <h2 className="text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold">
              Empieza tu primera asignatura hoy.
            </h2>
            <p className="my-2.5 mb-5 opacity-90">Plan gratis para siempre. Sin tarjeta.</p>
            <AuthMenu
              align="left"
              triggerClassName="rounded-full bg-white px-7 py-3.5 text-[0.95rem] font-semibold text-accent transition-transform hover:-translate-y-1 hover:shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]"
            >
              Únete gratis
            </AuthMenu>
          </div>
          <div className="relative h-[150px] w-[220px] shrink-0">
            <div className="absolute left-0 top-0 w-[170px] -rotate-6 rounded-2xl bg-[#ebda3c] p-[18px] shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)]">
              <span className="text-xs font-semibold opacity-65">Ensayo · activo</span>
              <p className="mt-2 font-bold">Esquema compartido</p>
            </div>
            <div className="absolute bottom-0 right-0 w-[170px] rounded-2xl bg-white p-[18px] text-[#0d0d0d] shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-xs font-semibold opacity-65">Química · activa</span>
              <p className="mt-2 font-bold">12 tarjetas listas</p>
            </div>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
