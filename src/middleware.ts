import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const ADMIN_PUBLIC_ROUTES = new Set([
  "/admin/login",
  "/admin/reset-password",
]);

// Agent portal public routes — reachable without a session (agents aren't
// logged in yet when they activate). Everything else under /agent is gated.
const AGENT_PUBLIC_ROUTES = new Set([
  "/agent/login",
  "/agent/activate",
  "/agent/forgot-password",
  "/agent/reset-password",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Propagate pathname to server components (admin layout reads this).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Auth-gate /admin/* and /agent/* page trees (skip their public sub-pages +
  // the auth callback). /api/* routes self-gate via getAdminUser / getAgentUser.
  const isAdmin = pathname.startsWith("/admin");
  const isAgent = pathname.startsWith("/agent");
  const isAuthCallback = pathname.startsWith("/api/auth/callback");
  const isPublicRoute =
    ADMIN_PUBLIC_ROUTES.has(pathname) || AGENT_PUBLIC_ROUTES.has(pathname);

  if ((!isAdmin && !isAgent) || isAuthCallback || isPublicRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Supabase SSR session check
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isAgent ? "/agent/login" : "/admin/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|pdf|mp4)$).*)"],
};
