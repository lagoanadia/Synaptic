import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProviderButtons } from "../landing/AuthMenu";

export const metadata = { title: "Entrar", alternates: { canonical: "/login" } };

// Straight to signing in: the landing's blue sheet and the two buttons.
export default async function Login() {
  if ((await auth())?.user?.id) redirect("/pursuits");
  return (
    <main
      id="login"
      className="grid min-h-[100dvh] place-items-center px-4"
      style={{
        backgroundColor: "#1c6fd1",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), radial-gradient(circle at 35% 30%, #3fa8ff, #1c6fd1 70%)",
        backgroundSize: "40px 40px, 40px 40px, 100% 100%",
      }}
    >
      <div className="flex w-full max-w-[320px] flex-col gap-5 rounded-2xl bg-white p-6 shadow-[0_24px_48px_-12px_rgba(13,13,13,0.3)]">
        <Link href="/web" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={24} height={24} className="rounded-md" />
          Synaptic Notes
        </Link>
        <h1 className="text-xl font-semibold text-ink">Entrar</h1>
        <div className="-mx-2 flex flex-col">
          <ProviderButtons />
        </div>
      </div>
    </main>
  );
}
