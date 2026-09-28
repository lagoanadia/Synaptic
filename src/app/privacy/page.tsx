import Link from "next/link";

export const metadata = { title: "Privacy Policy — Synaptic" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:underline">
          ← Synaptic
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-ink-faint">Last updated September 2026</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink">
        <p>
          Synaptic is a personal project built and run by Nadia Lagoa Vilela, based in
          A Coruña, Spain. This page describes what data Synaptic collects, why, and
          what you can do about it. Questions or requests:{" "}
          <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
            lagoanadia@gmail.com
          </a>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">What we collect</h2>
          <p>
            <strong>Account info</strong> — when you sign in with GitHub or Google, we
            receive your name, email address, and profile picture from them. We never
            see or store your GitHub/Google password.
          </p>
          <p>
            <strong>What you create</strong> — brain dumps (text, pasted/uploaded
            images), organized notes, flashcards, voice note recordings and their
            transcripts, tags, sections, and pursuit titles. This is the actual content
            of the app — it exists because you typed, pasted, or recorded it.
          </p>
          <p>
            <strong>Usage data</strong> — how many times per day you’ve used an AI
            feature (Organize, Ask, voice transcription), so the free daily limit can be
            enforced. We don’t track page views, clicks, or behavior beyond this.
          </p>
          <p>
            <strong>Billing data</strong> — if you subscribe to a paid plan, Stripe
            handles your card details directly; we never see or store your card
            number. We keep only your Stripe customer/subscription IDs and current
            plan, so the app knows what you’re entitled to.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Who else sees it</h2>
          <p>We don’t sell your data. It passes through these services to make the app work:</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li>
              <strong>GitHub / Google</strong> — for signing in (OAuth). They see that
              you’re signing into Synaptic; we see your name, email, and picture back.
            </li>
            <li>
              <strong>Groq</strong> — the AI provider behind Organize, Ask, flashcard
              generation, and voice transcription. Whatever you ask it to process gets
              sent to Groq’s API to generate a response; it isn’t used to train Groq’s
              models beyond their own data-processing terms.
            </li>
            <li>
              <strong>Stripe</strong> — processes payments and manages subscriptions for
              paid plans. Stripe has its own privacy policy for the payment data it
              handles directly.
            </li>
            <li>
              <strong>Vercel</strong> — hosts the app and its database. Standard
              infrastructure request logs (IP address, timestamp) pass through them as
              part of serving the site.
            </li>
          </ul>
          <p>
            If you share a pursuit with someone else’s account, that person can see the
            content of that pursuit (and, if you make them an editor, edit it) —
            that’s the sharing feature working as intended, not a third party.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Cookies</h2>
          <p>
            Synaptic sets one cookie: an encrypted session token that keeps you signed
            in. It’s strictly necessary for the app to function and isn’t used for
            tracking or advertising, so no cookie consent banner is shown — there’s
            nothing optional to consent to.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">How long we keep it</h2>
          <p>
            Your content stays until you delete it or close your account. To delete
            your account and everything in it, email{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            — it’ll be done within a few days. Deleting a pursuit inside the app
            deletes that pursuit’s content immediately and permanently.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Your rights</h2>
          <p>
            If you’re in the EU/EEA or UK, you have the right to access, correct,
            export, or delete your personal data, and to object to or restrict how
            it’s processed. Email{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            for any of these — most pursuit content can also be exported yourself as
            Markdown directly from the app (the “↓ Export” link on any pursuit).
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">International transfers</h2>
          <p>
            Groq, GitHub, Google, Stripe, and Vercel operate globally, so your data may
            be processed outside the EU/EEA (commonly the US) as part of using their
            services. Each provider maintains its own safeguards for these transfers
            under their respective terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Age</h2>
          <p>
            Synaptic is built with students in mind but isn’t directed at children.
            Don’t use it if you’re under 16 without a parent or guardian’s consent.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Changes</h2>
          <p>
            If this policy changes in a way that matters, the “Last updated” date above
            will change and, for anything significant, we’ll say so on the landing
            page.
          </p>
        </section>

        <p className="text-xs text-ink-faint">
          This is a plain-language description of an actual small project’s actual
          practices, written by its one developer — not a substitute for a lawyer’s
          review if you’re relying on it for something high-stakes.
        </p>
      </div>
    </div>
  );
}
