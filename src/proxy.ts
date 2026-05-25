import { NextResponse, type NextRequest } from "next/server";

// Inlined (not imported from src/lib/auth) because proxy is bundled separately
// for the edge and pulling in @supabase/ssr would bloat that bundle. If you
// add a user slug here, also add it in src/lib/auth.ts.
const USER_COOKIE = "user_slug";
const VALID_SLUGS = new Set(["sujal", "pratyush"]);

export function proxy(request: NextRequest) {
  const slug = request.cookies.get(USER_COOKIE)?.value;

  if (slug && VALID_SLUGS.has(slug)) {
    return NextResponse.next();
  }

  // Not logged in (or cookie tampered). Send to /login with ?next=<original>
  // so we can return them after they pick a user.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except /login, Next internals, and the favicon. The
  // negative-lookahead pattern is the standard Next recipe.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
