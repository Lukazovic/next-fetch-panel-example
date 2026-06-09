import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get("__dev_sid")?.value;
  const sid = existing ?? crypto.randomUUID();

  // Forward as a request header so headers() from next/headers exposes it
  // throughout the entire async context of this request — including inside
  // the globalThis.fetch patch in instrumentation.ts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-dev-sid", sid);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existing) {
    response.cookies.set("__dev_sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
