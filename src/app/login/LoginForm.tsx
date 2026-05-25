"use client";

import { useState, useTransition } from "react";
import { loginAs } from "./actions";

const USERS = [
  { slug: "sujal", display_name: "Sujal", avatar_emoji: "🦁" },
  { slug: "pratyush", display_name: "Pratyush", avatar_emoji: "🐯" },
] as const;

export function LoginForm({
  next,
  errorMessage,
}: {
  next: string;
  errorMessage?: string;
}) {
  // Password lives in React state so a single input can drive both name
  // buttons — alternative would be two duplicate inputs, one per <form>.
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function pick(slug: string) {
    if (isPending) return;
    startTransition(async () => {
      await loginAs(slug, next, password);
    });
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <p
          role="alert"
          className="rounded border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm px-3 py-2"
        >
          {errorMessage}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-500"
          placeholder="shared password"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 pt-1">
        {USERS.map((u) => (
          <button
            key={u.slug}
            type="button"
            onClick={() => pick(u.slug)}
            disabled={isPending || password.length === 0}
            className="w-full flex items-center gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 text-left hover:border-zinc-400 dark:hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
              {isPending ? "…" : "→"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
