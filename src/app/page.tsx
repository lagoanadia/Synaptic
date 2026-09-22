import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-8">
      <h1 className="text-2xl font-semibold text-ink">Synaptic</h1>

      {session?.user ? (
        <div className="flex flex-col items-center gap-4 text-center">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              className="h-16 w-16 rounded-full"
            />
          )}
          <p className="text-ink-muted">
            Signed in as <strong>{session.user.name}</strong> (
            {session.user.email})
          </p>
          <a
            href="/pursuits"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Go to your pursuits
          </a>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-border-subtle px-4 py-2 text-sm font-medium text-ink hover:bg-chip"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("github");
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in with GitHub
          </button>
        </form>
      )}
    </div>
  );
}
