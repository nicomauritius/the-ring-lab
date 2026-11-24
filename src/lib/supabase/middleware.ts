import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

type Role = "customer" | "jeweler" | "admin";

/** Path prefixes that need a signed-in user, and which roles may enter. */
const protectedRoutes: { prefix: string; roles: Role[] | "any" }[] = [
  { prefix: "/account", roles: "any" },
  { prefix: "/jeweler", roles: ["jeweler", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie. Do not put code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const rule = protectedRoutes.find((r) => matches(pathname, r.prefix));
  if (!rule) return response;

  const redirectTo = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) {
    return redirectTo("/sign-in", pathname + request.nextUrl.search);
  }

  if (rule.roles !== "any") {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role as Role | undefined;
    if (!role || !rule.roles.includes(role)) {
      return redirectTo("/account");
    }
  }

  return response;
}
