import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors so they land on the login page with a return path.
 * This only checks that a session cookie exists; every page, action and API route still verifies
 * the session and the user's role on the server.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("fz_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/onboarding/:path*", "/projects/:path*", "/orders/:path*", "/opportunities/:path*", "/quotations/:path*",
    "/payments/:path*", "/disputes/:path*", "/notifications/:path*", "/profile/:path*", "/factory/:path*", "/settings/:path*",
    "/admin/:path*", "/search/:path*", "/sandbox-checkout/:path*",
  ],
};
