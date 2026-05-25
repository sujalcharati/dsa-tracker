import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{
  next?: string | string[];
  error?: string | string[];
}>;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = firstParam(params.next) ?? "/";
  const errorCode = firstParam(params.error);
  const errorMessage =
    errorCode === "incorrect"
      ? "Incorrect password — or wrong button. Try again."
      : undefined;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            DSA Tracker
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Who&apos;s this?</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Type the shared password, then pick yourself.
          </p>
        </header>

        <LoginForm next={next} errorMessage={errorMessage} />
      </div>
    </main>
  );
}
