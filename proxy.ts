import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "rauto-manager-secret-key-change-in-production"
);

// 公开路径（不需要认证）
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth/init",
  "/api/auth/login",
  // Agent 通信端点（使用 X-API-Key 认证，不走 JWT cookie）
  "/api/agents/register",
  "/api/agents/heartbeat",
  "/api/agents/offline",
  "/api/agents/report-devices",
  "/api/agents/update-device-status",
  "/api/tasks/callback",
  // SSE 通知流（需要 JWT，但不能被 proxy 重定向，因为 EventSource 不支持重定向）
  "/api/notifications/stream",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和 Next.js 内部路径直接放行
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 检查是否是公开路径
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // 获取 token
  const token = request.cookies.get("auth-token")?.value;

  // 验证 token
  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch {
      // Token 无效或过期
      isAuthenticated = false;
    }
  }

  // 已认证用户访问登录/设置页面，重定向到首页
  if (isAuthenticated && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 未认证用户访问受保护路径，重定向到登录页
  // 初始化检查由 /login 页面客户端调用 /api/auth/init 完成
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
