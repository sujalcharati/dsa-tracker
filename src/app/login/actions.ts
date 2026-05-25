"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_COOKIE, isValidSlug } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function sanitizeNext(next: string): string {
  // Don't redirect to attacker-controlled URLs; only allow same-origin paths.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Logs in by picking a user slug and verifying the shared password.
 *
 * `slug` is typed `string` (not UserSlug) on purpose: server actions cross
 * a network boundary, so the runtime value could be anything. Both `slug`
 * and `password` are runtime-validated below.
 *
 * Password gate is intentionally coarse — one shared secret for both users,
 * checked at login time only. The cookie that follows doesn't carry the
 * password, so rotating the env var locks out new logins but doesn't
 * invalidate existing sessions. That's fine for our threat model (raise
 * the bar against URL discovery + scrapers); for stronger guarantees,
 * switch to Supabase Auth (see CLAUDE.md notes on Layer 2 exposure).
 */
export async function loginAs(
  slug: string,
  next: string = "/",
  password: string = "",
) {
  const safeNext = sanitizeNext(next);

  const expected = process.env.SHARED_PASSWORD;
  if (!expected) {
    // Fail closed: refuse all logins if the password isn't configured.
    // A friendly error here is much better than silently allowing access.
    throw new Error(
      "SHARED_PASSWORD is not set. Add it to .env.local (and Vercel env in prod).",
    );
  }

  if (!isValidSlug(slug) || password !== expected) {
    // Don't differentiate "wrong user" from "wrong password" in the response —
    // a noise-floor measure against probing.
    redirect(`/login?error=incorrect&next=${encodeURIComponent(safeNext)}`);
  }

  const c = await cookies();
  c.set({
    name: USER_COOKIE,
    value: slug,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });
  redirect(safeNext);
}

export async function logout() {
  const c = await cookies();
  c.delete(USER_COOKIE);
  redirect("/login");
}
