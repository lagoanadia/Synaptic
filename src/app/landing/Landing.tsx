import { Fraunces, Caveat } from "next/font/google";
import Link from "next/link";
import { AuthMenu } from "./AuthMenu";
import { Motion } from "./Motion";
import { Stage, Thing } from "./Scene";

const serif = Fraunces({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-lnd-serif" });
const hand = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-lnd-hand" });

// The hero map: the same notes as the pile on the left, now tidy and tied together.
const NODES: [number, number][] = [[880, 220], [1110, 150], [1310, 300], [1040, 460], [1290, 640], [880, 680]];
const LINKS: [number, number][] = [[0, 1], [1, 2], [0, 3], [3, 2], [3, 4], [3, 5], [4, 2]];
const LABELS = ["Bases de datos", "Tablas", "Claves", "JOIN", "Índices", "SQL"];
const curve = ([ax, ay]: [number, number], [bx, by]: [number, number]) => `M${ax} ${ay} Q${(ax + bx) / 2 + 14} ${(ay + by) / 2 + 16} ${bx} ${by}`;

const STEPS = [
  { title: "Escribe", text: "Suelta tus pensamientos tal como surgen: texto, fotos o notas de voz. No hace falta darles formato." },
  { title: "Organiza", text: "Synaptic los estructura en secciones, destaca los conceptos clave y genera un mapa por tema." },
  { title: "Repasa", text: "Sesiones breves y diarias, centradas en lo que todavía no dominas." },
];

const cta = "inline-block rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[#111] transition-transform hover:-translate-y-0.5";

export function Landing() {
  return (
    <main id="landing" className={`lnd ${serif.variable} ${hand.variable} relative overflow-hidden text-white`}>
      <Motion rootId="landing" />

      {/* ── Hero ── */}
      <section className="relative">
        <nav className="relative z-20 flex items-center gap-10 px-5 pt-5 text-[13px] lg:absolute lg:inset-x-10 lg:top-6 lg:px-0 lg:pt-0">
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <img src="/logo-mark.png" alt="" width={24} height={24} className="rounded-md" />
            Synaptic Notes
          </span>
          <a href="#como-funciona" className="hidden opacity-90 hover:opacity-100 md:inline">Cómo funciona</a>
          <a href="#herramientas" className="hidden opacity-90 hover:opacity-100 md:inline">Herramientas</a>
          <a href="#sobre" className="hidden opacity-90 hover:opacity-100 md:inline">Sobre Synaptic</a>
          <span className="flex-1" />
          <AuthMenu align="right" triggerClassName="rounded-full bg-white px-[18px] py-2 text-[13px] font-semibold text-[#1c6fd1]">
            Entrar
          </AuthMenu>
        </nav>

        <div className="lnd-glass relative z-10 mx-4 mt-6 px-7 pt-5 pb-8 lg:absolute lg:top-[11.5%] lg:left-[4.4%] lg:m-0 lg:w-[37.5%] lg:px-[2.6vw] lg:pt-[1.4vw] lg:pb-[2.2vw]">
          <div className="mb-6 flex gap-[7px]" aria-hidden>
            <span className="size-[11px] rounded-full bg-[#ff6a5f]" />
            <span className="size-[11px] rounded-full bg-[#ffc23d]" />
            <span className="size-[11px] rounded-full bg-[#2bc840]" />
          </div>
          <h1 className="lnd-serif text-[clamp(3.2rem,5.85vw,6.5rem)] leading-[.95] font-extrabold tracking-[-0.03em]">
            Tu cabeza,
            <br />
            en orden.
          </h1>
          <p className="mt-5 max-w-[470px] text-[clamp(1rem,1.32vw,1.25rem)] leading-normal font-medium">
            Tienes mil cosas en la cabeza y ninguna en su sitio. Suéltalas aquí: Synaptic pone el orden.
          </p>
          <div className="mt-7">
            <AuthMenu align="left" triggerClassName={cta}>
              Vacía tu cabeza →
            </AuthMenu>
          </div>
        </div>

        {/* On phones the scene is cropped to its busy part, so the papers stay readable. */}
        <div className="overflow-hidden lg:overflow-visible">
        <Stage width={1440} height={900} className="mt-[-10vw] w-[140%] lg:mt-0 lg:w-full">
          <div className="absolute inset-0" style={{ transform: "scale(1.22)", transformOrigin: "0 100%" }}>
            {(
              [
                ["notebook", 470, 640, -14, null],
                ["paper", 90, 640, -16, <>tema 3<br />¿¿JOIN??</>],
                ["sticky", 270, 680, 14, "examen jueves!!"],
                ["paper", 360, 620, 24, <>apuntes<br />clase 12</>],
                ["pink", 180, 750, -10, "repasar UD2"],
                ["pencil", 300, 800, 30, null],
                ["coffee", 470, 760, 0, null],
              ] as const
            ).map(([kind, x, y, r, label], i) => (
              <Thing key={i} kind={kind} x={x} y={y} r={r} depth={0.4 + (i % 4) * 0.25} className="lnd-float" style={{ animationDelay: `${-i * 0.9}s` }}>
                {label}
              </Thing>
            ))}
          </div>
          <svg className="lnd-intro-draw lnd-draw absolute inset-0 h-full w-full" viewBox="0 0 1440 900" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={3} strokeLinecap="round" aria-hidden>
            {LINKS.map(([a, b]) => <path key={`${a}-${b}`} d={curve(NODES[a], NODES[b])} />)}
          </svg>
          {NODES.map(([x, y], i) => (
            <Thing key={i} kind={i % 3 === 1 ? "note" : "paper"} x={x - 60} y={y - 78} className="lnd-pop" style={{ transitionDelay: `${0.5 + i * 0.18}s` }}>
              {LABELS[i]}
            </Thing>
          ))}
        </Stage>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="como-funciona" className="mx-auto max-w-[1248px] px-5 pt-20 lg:px-0 lg:pt-28">
        <h2 className="lnd-reveal lnd-serif text-[clamp(2.4rem,4.2vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.025em]">
          De tu cabeza al orden,
          <br className="max-sm:hidden" />
          en tres pasos.
        </h2>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="lnd-reveal" style={{ transitionDelay: `${i * 0.15}s` }}>
              <Stage width={390} height={220}>
                {i === 0 && (
                  <>
                    <Thing kind="paper" x={20} y={0} r={-12}><>¿qué era<br />un índice?</></Thing>
                    <Thing kind="sticky" x={160} y={70} r={10}>¡ojo!</Thing>
                    <Thing kind="paper" x={250} y={6} r={16}><>viaje<br />Lisboa</></Thing>
                  </>
                )}
                {i === 1 && (
                  <>
                    <Thing kind="paper" x={30} y={10}>Estudios</Thing>
                    <Thing kind="note" x={250} y={30}>Planes</Thing>
                    <svg className="lnd-draw-on-view lnd-draw absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 390 220" fill="none" aria-hidden>
                      <path d="M150 85 Q 200 100 250 75" stroke="#fff" strokeWidth={3} />
                    </svg>
                  </>
                )}
                {i === 2 && (
                  <>
                    <Thing kind="coffee" x={40} y={40} />
                    <Thing kind="phone" x={180} y={0} r={-10} />
                    <Thing kind="pink" x={280} y={80} r={8}>12/12 ✓</Thing>
                  </>
                )}
              </Stage>
              <div className="lnd-glass mt-4 px-7 py-6">
                <h3 className="lnd-serif text-[38px] font-extrabold">{s.title}</h3>
                <p className="mt-2 text-base leading-relaxed opacity-95">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tools: pieces of the app lying on the sheet ── */}
      <section id="herramientas" className="mx-auto max-w-[1248px] px-5 pt-28 lg:px-0 lg:pt-40">
        <h2 className="lnd-reveal lnd-serif text-[clamp(2.4rem,4.2vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.025em]">
          Pensado para estudiar
          <br className="max-sm:hidden" />
          y para organizarte.
        </h2>
        <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1.45fr_1fr]">
          <div className="lnd-reveal lnd-lie" style={{ rotate: "-1.2deg" }}>
            <div className="lnd-card lnd-tilt px-9 py-8">
              <div className="mb-3 text-xs text-[#9b9a97]">Estudios · Bases de datos</div>
              <div className="lnd-serif mb-3.5 text-[30px] font-bold">Consultas con varias tablas</div>
              <p className="text-base leading-[1.75]">
                Para unir dos tablas se usa un <span className="lnd-term">JOIN</span> sobre la <span className="lnd-term">clave foránea</span>. Si la consulta es lenta, un{" "}
                <span className="lnd-term">índice</span> en esa columna lo resuelve.
              </p>
              <div className="lnd-card mt-5 ml-auto w-[300px] max-w-full px-[18px] py-4 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:mr-16">
                <b>JOIN</b>
                <p className="mt-1 text-sm text-[#787774]">Combina filas de dos tablas que comparten un valor.</p>
                <p className="mt-2 text-xs text-[#2383e2]">↗ en el mapa del tema</p>
              </div>
              <p className="mt-5 text-sm text-[#787774]">Los conceptos clave se destacan automáticamente y muestran su definición al pasar el cursor.</p>
            </div>
          </div>
          <div className="grid gap-8">
            <div className="lnd-reveal lnd-lie" style={{ rotate: "1.8deg", transitionDelay: ".12s" }}>
              <div className="lnd-card lnd-tilt px-7 py-7">
                <div className="lnd-serif text-2xl font-bold">Mapa de conceptos interactivo</div>
                <svg width="100%" height="120" viewBox="0 0 360 120" aria-hidden>
                  <g stroke="#d8d3c9" strokeWidth="2">
                    <line x1="60" y1="60" x2="160" y2="30" /><line x1="160" y1="30" x2="270" y2="70" /><line x1="160" y1="30" x2="180" y2="100" /><line x1="270" y1="70" x2="330" y2="30" />
                  </g>
                  <g fill="#2383e2" stroke="#2383e2" strokeWidth="2">
                    <circle cx="60" cy="60" r="9" /><circle cx="160" cy="30" r="11" /><circle cx="270" cy="70" r="9" fill="#fff" /><circle cx="180" cy="100" r="7" fill="#fff" /><circle cx="330" cy="30" r="7" />
                  </g>
                </svg>
                <p className="text-sm text-[#787774]">Cada concepto muestra tu nivel: dominado o pendiente de repaso.</p>
              </div>
            </div>
            <div className="lnd-reveal lnd-lie" style={{ rotate: "-2deg", transitionDelay: ".24s" }}>
              <div className="lnd-card lnd-tilt flex items-center gap-5 px-7 py-6">
                <svg width="88" height="88" viewBox="0 0 92 92" className="shrink-0" aria-hidden>
                  <circle cx="46" cy="46" r="38" fill="none" stroke="#eee" strokeWidth="10" />
                  <circle className="lnd-ring" cx="46" cy="46" r="38" fill="none" stroke="#2383e2" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 46 46)" />
                  <text x="46" y="53" textAnchor="middle" fontSize="20" fontWeight="700" fill="#37352f">10/12</text>
                </svg>
                <div>
                  <div className="lnd-serif text-2xl font-bold">Repaso diario</div>
                  <p className="mt-1.5 text-sm text-[#787774]">Hasta 12 preguntas al día, adaptadas a tu progreso.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="lnd-reveal mt-12 flex flex-wrap gap-3.5 text-[15px]">
          {["Libretas y carpetas", "Google Classroom", "Google Calendar", "Retos de código"].map((t) => (
            <span key={t} className="rounded-full border-[1.5px] border-white/85 px-[18px] py-2">{t}</span>
          ))}
        </div>
      </section>

      {/* ── Why ── */}
      <section id="sobre" className="lnd-reveal mx-auto max-w-[1100px] px-5 pt-32 text-center lg:pt-44">
        <p className="lnd-serif text-[clamp(1.9rem,3.05vw,2.75rem)] leading-[1.22] font-bold">
          “Quería un sistema que se ordenara solo. Yo pongo las ideas; Synaptic, el orden.”
        </p>
        <p className="mt-6 text-[15px] opacity-85">Nadia Lagoa · estudiante de Desarrollo de Aplicaciones Multiplataforma</p>
      </section>

      {/* ── Final call ── */}
      <section className="mx-auto grid max-w-[1312px] items-center gap-6 px-5 pt-32 pb-10 lg:grid-cols-[1fr_.85fr] lg:px-0 lg:pt-44">
        <div className="lnd-reveal lnd-glass px-10 py-10 lg:px-11">
          <h2 className="lnd-serif text-[clamp(2.4rem,4.4vw,4rem)] leading-[1.02] font-extrabold tracking-[-0.025em]">
            Empieza a ordenar
            <br />
            tu cabeza hoy.
          </h2>
          <div className="mt-8">
            <AuthMenu align="left" triggerClassName={cta}>
              Empieza gratis →
            </AuthMenu>
          </div>
        </div>
        <div className="lnd-reveal" style={{ transitionDelay: ".15s" }}>
          <Stage width={560} height={380}>
            <Thing kind="paper" x={150} y={50} r={12}><>hoy:<br />ordenar<br />apuntes</></Thing>
            <Thing kind="sticky" x={310} y={210} r={-10}>y descansar</Thing>
            <Thing kind="coffee" x={20} y={230} />
            <Thing kind="notebook" x={380} y={10} r={8} />
          </Stage>
        </div>
      </section>

      <footer className="flex justify-between px-10 pt-10 pb-8 text-xs opacity-85">
        <span>synapticnotes.app</span>
        <span>
          <Link href="/privacy" className="hover:underline">Privacidad</Link> · <Link href="/terms" className="hover:underline">Términos</Link>
        </span>
      </footer>
    </main>
  );
}
