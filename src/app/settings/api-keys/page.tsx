import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiKeyManager } from "./ApiKeyManager";

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const mcpUrl =
    typeof process.env.VERCEL_PROJECT_PRODUCTION_URL === "string"
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/mcp`
      : "/api/mcp";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-9">
      <Link href="/pursuits" className="text-sm text-ink-muted hover:underline">
        ← Pursuits
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-ink-muted">
          Lets another tool (Claude Desktop, an agent, a script) read and write your
          own Pursuits through Synaptic&apos;s MCP server — the same access you have,
          under a key you can revoke any time.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-callout p-4">
        <p className="text-sm font-semibold">Connect to the MCP server</p>
        <p className="text-sm text-ink-muted">
          Server URL:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">{mcpUrl}</code>
        </p>
        <p className="text-sm text-ink-muted">
          Auth: <code className="rounded bg-white px-1.5 py-0.5 text-xs">Bearer &lt;your key&gt;</code>
        </p>
      </div>

      <ApiKeyManager
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
