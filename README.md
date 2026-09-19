# Synaptic

Most tracking apps ask you to organize as you capture — pick a category, add a tag, file it away — before you've even finished the thought. Synaptic splits that in two: **dump first, organize later.**

Pick one **Pursuit** (a project, a book, a language, a skill — anything you're learning by doing) and the whole app becomes just that pursuit. Inside it:

- **Brain Dump** — zero-friction capture. Type whatever's in your head, paste an image, no structure required.
- **Organized** — hit "Organize" and Claude synthesizes your raw dumps into a coherent, tagged note. You stay in control of the tags; the AI just does the tedious first pass.
- **Files** — loose reference material that lives with the pursuit, no AI pipeline involved.

Pursuits can be shared: invite a collaborator by email and you both dump into and organize the same pursuit together.

## Why it's built this way

A flat, unlimited tag list (like a Notion database's free-text multi-select) tends to degrade into noise over time — nothing stops it from growing into an incoherent pile. Synaptic's schema is designed around that lesson specifically:

- **Note tags** are scoped *per pursuit* — the tag list you see while tagging is always small and relevant to what you're looking at, so unrelated topics can never mix into the same dropdown.
- **Pursuit tags** (`#portfolio`, `#web-dev`) are a separate, smaller, global vocabulary for categorizing the pursuits themselves — a different scale of problem, so it gets a different (looser) rule.
- **`type` is a closed 5-value enum** (Project / Book / Language / Skill / Other), not a free-form field — with an escape hatch: picking "Other" reveals a custom label field, so you get flexibility without an unbounded, ever-growing list.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Components + Server Actions — no separate API layer for most mutations)
- **Prisma 7** + PostgreSQL
- **NextAuth v5** (Auth.js) with the Prisma adapter — GitHub OAuth, database-backed sessions
- **Claude API** (`@anthropic-ai/sdk`, `claude-opus-5`) for the Organize step, including image input from brain-dumped photos/screenshots
- **Tailwind CSS**

## Data model

```
User ─┬─< Pursuit (owned)
      ├─< PursuitMember >─ Pursuit (shared)
      └─< PursuitTag >─ Pursuit

Pursuit ─┬─< BrainDump ─┬─< Note >─┬─< Tag
         ├─< Note ──────┘          │
         └─< Attachment            └─ (scoped to this Pursuit)
```

Full schema: [`prisma/schema.prisma`](./prisma/schema.prisma).

## Running locally

```bash
git clone https://github.com/lagoanadia/Synaptic.git
cd Synaptic
npm install

npx prisma dev -d        # starts a local Postgres, prints a connection string
npx prisma migrate deploy
```

Create a `.env` file (never committed):

```
DATABASE_URL="<the connection string from `prisma dev` above>"
AUTH_SECRET="<generate with: openssl rand -base64 33>"
AUTH_GITHUB_ID="<from a GitHub OAuth App: github.com/settings/applications/new>"
AUTH_GITHUB_SECRET="<same place>"
ANTHROPIC_API_KEY="<from console.anthropic.com — required for the Organize feature>"
```

For the GitHub OAuth App: Homepage URL `http://localhost:3000`, Authorization callback URL `http://localhost:3000/api/auth/callback/github`.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
