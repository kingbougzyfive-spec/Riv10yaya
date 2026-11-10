import { NextResponse, type NextRequest } from "next/server";

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 1. CSRF: a browser write to /api must come from this site. Origin (or Sec-Fetch-Site) is checked in addition
 *     to the SameSite=Lax session cookie. Requests with no Origin at all (curl, server to server) carry no
 *     browser cookies of a victim, so they are not a CSRF vector and are allowed through to normal auth.
 *  2. Cheap first gate: no session cookie on /admin or /print goes to login. Real authorization still happens on
 *     the server in every page and route handler.
 *  3. Passes the path along so a person on a temporary password can be kept on the change-password screen. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && WRITE.has(req.method)) {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    let bad = site === "cross-site";
    if (origin && origin !== "null") { try { bad = bad || new URL(origin).host !== host; } catch { bad = true; } }
    else if (origin === "null") bad = true;
    if (bad) return NextResponse.json({ error: "Request blocked: it didn't come from this site." }, { status: 403 });
  }

  if ((pathname.startsWith("/admin") || pathname.startsWith("/print") || pathname.startsWith("/portal")) && !req.cookies.get("yaya_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const h = new Headers(req.headers);
  h.set("x-path", pathname);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/admin/:path*", "/print/:path*", "/me/:path*", "/member", "/api/:path*"] };
