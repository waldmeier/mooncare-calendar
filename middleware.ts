import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 🔒 Nur /admin schützen
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  const base64Credentials = authHeader.replace("Basic ", "");
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [user, pass] = credentials.split(":");

  if (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.next();
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mooncare Admin"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};