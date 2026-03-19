import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "rauto-manager-secret-key-change-in-production"
);

// Public paths that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth/init",
  "/api/auth/login",
  // Agent communication endpoints use X-API-Key auth instead of JWT cookies
  "/api/agents/register",
  "/api/agents/heartbeat",
  "/api/agents/offline",
  "/api/agents/report-devices",
  "/api/agents/update-device-status",
  "/api/agents/report-error",
  "/api/agents/report-task-event",
  "/api/agents/report-task-callback",
  "/api/tasks/callback",
  // The SSE notification stream still needs JWT auth, but cannot be redirected by proxy
  "/api/notifications/stream",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internal paths through immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check whether the current path is public
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // Read the auth token from cookies
  const token = request.cookies.get("auth-token")?.value;

  // Verify the auth token
  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch {
      // Token is invalid or expired
      isAuthenticated = false;
    }
  }

  // Redirect authenticated users away from login and setup pages
  if (isAuthenticated && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users visiting protected routes to /login
  // The initialization check is handled client-side on /login via /api/auth/init
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
