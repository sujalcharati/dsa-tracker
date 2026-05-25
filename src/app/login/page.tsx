import { loginAs } from "./actions";

type SearchParams = Promise<{ next?: string | string[] }>;

const USERS = [
  { slug: "sujal", display_name: "Sujal", avatar_emoji: "🦁" },
  { slug: "pratyush", display_name: "Pratyush", avatar_emoji: "🐯" },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = nextRaw ?? "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            DSA Tracker
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Who&apos;s this?</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick yourself. Your progress is tied to whichever name you pick — be honest.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3">
          {USERS.map((u) => (
            <form key={u.slug} action={loginAs.bind(null, u.slug, next)}>
              <button
                type="submit"
                className="w-full flex items-center gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <span className="text-3xl" aria-hidden>
                  {u.avatar_emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">I&apos;m {u.display_name}</span>
                  <span className="block text-xs text-zinc-500">
                    slug: {u.slug}
                  </span>
                </span>
                <span className="text-zinc-400" aria-hidden>
                  →
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
