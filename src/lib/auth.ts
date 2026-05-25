import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Closed app, two users on a public URL. The cookie holds an identity (which
// human is using this tab), not a session — there's no password, no signing,
// no expiry beyond "I want to stay logged in for a long time". Security model
// is "you know the URL".
export const USER_COOKIE = "user_slug";

// Allowlist enforced in code so a crafted cookie like `user_slug=admin` can
// never hit the DB. Mirror the slugs seeded in supabase/migrations/0001_init.sql.
export const VALID_SLUGS = ["sujal", "pratyush"] as const;
export type UserSlug = (typeof VALID_SLUGS)[number];

const VALID_SLUG_SET: ReadonlySet<string> = new Set(VALID_SLUGS);

export function isValidSlug(slug: string | undefined | null): slug is UserSlug {
  return typeof slug === "string" && VALID_SLUG_SET.has(slug);
}

// Cheap, cookie-only check. Use this in server actions that only need to know
// *who* is calling — they don't need the full user row.
export async function getCurrentUserSlug(): Promise<UserSlug | null> {
  const c = await cookies();
  const raw = c.get(USER_COOKIE)?.value;
  return isValidSlug(raw) ? raw : null;
}

export type CurrentUser = {
  id: string;
  slug: UserSlug;
  display_name: string;
  avatar_emoji: string;
};

// Full user row — one DB roundtrip. Use in pages that render the user's name
// or anywhere we need the uuid (for joins to progress/revisions).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const slug = await getCurrentUserSlug();
  if (!slug) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, slug, display_name, avatar_emoji")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as CurrentUser;
}
