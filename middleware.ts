import { NextResponse, type NextRequest } from "next/server";

/** Cheap first gate: no session cookie → login. Real authorization happens on the server in every page/route. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("yaya_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/print/:path*"] };
