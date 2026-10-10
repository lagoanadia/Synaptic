export type Locale = "en" | "de" | "fr" | "es";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

export function isLocale(value: string): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

// Only the onboarding tour is actually translated today — see Tour.tsx's
// callers in pursuits/page.tsx and pursuits/[id]/page.tsx. The rest of
// the app's copy is plain English JSX text, not routed through this at
// all; this exists so the one piece of non-English content that existed
// (the tour, originally written in Spanish) stops being the odd one out,
// with a path to translate more later instead of hardcoding one language.
export const TOUR_UI = {
  en: { skip: "Skip tutorial", next: "Next", done: "Got it" },
  de: { skip: "Tutorial überspringen", next: "Weiter", done: "Verstanden" },
  fr: { skip: "Passer le tutoriel", next: "Suivant", done: "Compris" },
  es: { skip: "Saltar tutorial", next: "Siguiente", done: "Entendido" },
} as const satisfies Record<Locale, { skip: string; next: string; done: string }>;

export type TourCopy = {
  list: { newProject: { title: string; body: string }; openExample: { title: string; body: string } };
  detail: {
    tabs: { title: string; body: string };
    statusNote: { title: string; body: string };
    searchBar: { title: string; body: string };
    dumpArea: { title: string; body: string };
  };
};

export const TOUR_COPY: Record<Locale, TourCopy> = {
  en: {
    list: {
      newProject: {
        title: "Create your first Pursuit",
        body: "A Pursuit is a subject, a project, or anything you want to track — give it a title here and click + New.",
      },
      openExample: {
        title: "We already made you an example",
        body: 'Open it — "👋 Welcome to Synaptic" — to see what a raw page looks like next to the organized note the AI turns it into.',
      },
    },
    detail: {
      tabs: {
        title: "A Pursuit's six views",
        body: "Brain Dump is where you jot things down raw. Organized is the clean notes the AI generates. Then Files, Ask (ask your own notes questions), Cards (spaced-repetition review) and Timeline.",
      },
      statusNote: {
        title: "Your status note",
        body: "A free space to jot down where you left off or what's still pending — not another note, just a reminder to yourself.",
      },
      searchBar: {
        title: "Search inside this Pursuit",
        body: "Find any word you've written, in both your raw pages and your organized notes.",
      },
      dumpArea: {
        title: "Capture, then organize",
        body: "Check one or more pages and click Organize to let the AI turn them into a clean note, like the example you already have in the Organized tab.",
      },
    },
  },
  de: {
    list: {
      newProject: {
        title: "Erstelle deine erste Pursuit",
        body: "Eine Pursuit ist ein Fach, ein Projekt oder alles, was du verfolgen möchtest — gib ihr hier einen Titel und klicke auf + New.",
      },
      openExample: {
        title: "Wir haben dir schon ein Beispiel erstellt",
        body: 'Öffne es — "👋 Welcome to Synaptic" — um zu sehen, wie eine rohe Seite neben der von der KI organisierten Notiz aussieht.',
      },
    },
    detail: {
      tabs: {
        title: "Die sechs Ansichten einer Pursuit",
        body: "In Brain Dump schreibst du alles roh auf. Organized sind die von der KI erstellten, aufgeräumten Notizen. Dann Files, Ask (stelle deinen eigenen Notizen Fragen), Cards (Wiederholung mit Spaced Repetition) und Timeline.",
      },
      statusNote: {
        title: "Deine Status-Notiz",
        body: "Ein freier Platz, um zu notieren, wo du aufgehört hast oder was noch zu tun ist — keine weitere Notiz, nur eine Erinnerung für dich selbst.",
      },
      searchBar: {
        title: "Suche innerhalb dieser Pursuit",
        body: "Finde jedes Wort, das du geschrieben hast — sowohl in deinen rohen Seiten als auch in deinen organisierten Notizen.",
      },
      dumpArea: {
        title: "Erfassen, dann organisieren",
        body: "Markiere eine oder mehrere Seiten und klicke auf Organize, damit die KI daraus eine aufgeräumte Notiz macht, wie das Beispiel im Organized-Tab.",
      },
    },
  },
  fr: {
    list: {
      newProject: {
        title: "Crée ta première Pursuit",
        body: "Une Pursuit est une matière, un projet, ou tout ce que tu veux suivre — donne-lui un titre ici et clique sur + New.",
      },
      openExample: {
        title: "On t'a déjà créé un exemple",
        body: 'Ouvre-le — "👋 Welcome to Synaptic" — pour voir à quoi ressemble une page brute à côté de la note organisée que l\'IA en tire.',
      },
    },
    detail: {
      tabs: {
        title: "Les six vues d'une Pursuit",
        body: "Brain Dump, c'est là où tu notes les choses en vrac. Organized, ce sont les notes propres générées par l'IA. Puis Files, Ask (pose des questions à tes propres notes), Cards (révision par répétition espacée) et Timeline.",
      },
      statusNote: {
        title: "Ta note de statut",
        body: "Un espace libre pour noter où tu en étais ou ce qu'il reste à faire — pas une note de plus, juste un rappel pour toi-même.",
      },
      searchBar: {
        title: "Cherche dans cette Pursuit",
        body: "Retrouve n'importe quel mot que tu as écrit, aussi bien dans tes pages brutes que dans tes notes organisées.",
      },
      dumpArea: {
        title: "Capture, puis organise",
        body: "Coche une ou plusieurs pages et clique sur Organize pour que l'IA en fasse une note propre, comme l'exemple déjà présent dans l'onglet Organized.",
      },
    },
  },
  es: {
    list: {
      newProject: {
        title: "Crea tu primera Pursuit",
        body: "Una Pursuit es una asignatura, un proyecto o cualquier cosa que quieras seguir — ponle un título aquí y pulsa + New.",
      },
      openExample: {
        title: "Ya te hemos creado un ejemplo",
        body: 'Ábrela — "👋 Welcome to Synaptic" — para ver cómo es un apunte en bruto junto a la nota ya organizada que genera la IA.',
      },
    },
    detail: {
      tabs: {
        title: "Las seis vistas de una Pursuit",
        body: "Brain Dump es donde apuntas todo en bruto. Organized son las notas limpias que genera la IA. Luego Files, Ask (pregúntale a tus apuntes), Cards (repaso espaciado) y Timeline.",
      },
      statusNote: {
        title: "Tu nota de estado",
        body: "Un espacio libre para apuntar en qué punto te quedaste o qué falta por hacer — no es un apunte más, solo un recordatorio para ti.",
      },
      searchBar: {
        title: "Busca dentro de esta Pursuit",
        body: "Encuentra cualquier palabra que hayas escrito, tanto en tus apuntes en bruto como en las notas organizadas.",
      },
      dumpArea: {
        title: "Captura y organiza",
        body: "Marca la casilla de uno o varios apuntes y pulsa Organize para que la IA los convierta en una nota limpia, como la que ya tienes de ejemplo en la pestaña Organized.",
      },
    },
  },
};
