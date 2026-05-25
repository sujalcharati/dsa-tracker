"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_COOKIE, isValidSlug } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// `slug` is typed `string` (not UserSlug) on purpose: server actions cross a
// network boundary, so the runtime value could be anything. `isValidSlug`
// gives us the real guarantee.
export async function loginAs(slug: string, next: string = "/") {
  if (!isValidSlug(slug)) {
    redirect("/login");
  }
  // Don't redirect to attacker-controlled URLs; only allow same-origin paths.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

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
