import Link from "next/link";

export const metadata = { title: "Terms of Service — Synaptic" };

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:underline">
          ← Synaptic
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-1 text-sm text-ink-faint">Last updated September 2026</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink">
        <p>
          Synaptic is a personal project run by Nadia Lagoa Vilela. By creating an
          account you agree to these terms. Questions:{" "}
          <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
            lagoanadia@gmail.com
          </a>
          . See also the{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">The service</h2>
          <p>
            Synaptic lets you capture notes, organize them with AI, and review them
            with flashcards and an AI assistant that answers from your own notes. It’s
            run by one person as a side project, not a company with a support team —
            treat it accordingly.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Your account</h2>
          <p>
            You sign in with a GitHub or Google account and are responsible for
            keeping that account secure. You’re responsible for what gets posted or
            uploaded under your account.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Plans and billing</h2>
          <p>
            Free plan usage limits (flashcards/month, daily AI uses, collaborators per
            pursuit) are described on the pricing page and may change with notice.
            Paid plans (Student Pro, Team) renew monthly and are billed through Stripe;
            you can cancel anytime from Billing → Manage billing, which stops the next
            renewal — you keep access for the rest of the period you already paid for.
          </p>
          <p>
            If you’re in the EU/EEA or UK, you have a 14-day right to withdraw from a
            new paid subscription for a full refund, starting from the day you
            subscribe — email{" "}
            <a href="mailto:lagoanadia@gmail.com" className="text-accent hover:underline">
              lagoanadia@gmail.com
            </a>{" "}
            to use it. Outside that window, payments already made aren’t refunded for
            partial months.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Your content</h2>
          <p>
            Whatever you capture, organize, or generate in Synaptic is yours. We
            don’t claim ownership of it — we just store it and process it (including
            sending it to Groq’s AI models) so the app’s features work. Don’t upload
            anything you don’t have the right to store or share, and don’t use the
            app to store or generate anything illegal, abusive, or infringing.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">AI features</h2>
          <p>
            Organize, Ask, and flashcard generation use a third-party AI model (Groq)
            and can get things wrong, miss context, or misread messy handwriting/notes.
            Treat AI output as a draft to check, not a verified fact, especially
            before relying on it for graded work.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Sharing pursuits</h2>
          <p>
            If you invite someone to a pursuit, they can see its content (and edit it,
            if you give them editor access). You’re responsible for only sharing with
            people you actually want to see that content.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">No warranty, limited liability</h2>
          <p>
            Synaptic is provided as-is, with no uptime guarantee — it’s one person’s
            side project running on standard hosting, not a service with an SLA. To
            the extent the law allows it, Synaptic and its developer aren’t liable for
            lost data, lost coursework, or any indirect damages from using or being
            unable to use the app. Export anything important (the “↓ Export” link) if
            you’d be upset to lose it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Ending your account</h2>
          <p>
            You can stop using Synaptic anytime and ask for your account to be deleted
            (see the Privacy Policy). We can also suspend or close an account that
            abuses the service or these terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Changes to these terms</h2>
          <p>
            If these terms change in a way that matters, we’ll note it on the landing
            page along with an updated date above.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Governing law</h2>
          <p>These terms are governed by Spanish law.</p>
        </section>
      </div>
    </div>
  );
}
