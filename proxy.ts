import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/app/lib/auth0";

function isProtectedApi(pathname: string) {
  return (
    pathname === "/api/tenant-portal/me" ||
    pathname === "/api/tenant-portal/pay" ||
    pathname === "/api/tenant-portal/pay/cancel"
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/portal" || isProtectedApi(pathname)) {
    const session = await auth0.getSession(req);
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return auth0.startInteractiveLogin({
        returnTo: pathname + search,
      });
    }
    // API routes handle their own auth via getAuthenticatedTenant().
    // Passing through auth0.middleware() for API routes interferes with
    // Next.js route resolution in v16 — just let them through.
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // For page routes, run auth0.middleware so it can refresh the session
    // cookie and handle any token rotation.
    return auth0.middleware(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
