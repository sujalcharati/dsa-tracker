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
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-10 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-500"
            placeholder="shared password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </label>

      <div aria-live="polite" className="sr-only">
        {showPassword ? "Password visible" : "Password hidden"}
      </div>

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

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
