import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

function tooManyRequests() {
  return NextResponse.json(
    { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát." },
    { status: 429 }
  );
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getRequestIp(req.headers);

  // Rate limit: Login attempts (10 requests / minute)
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const key = `rl:login:${ip}`;
    const result = checkRateLimit(key, 10, 60_000);
    if (!result.allowed) return tooManyRequests();
  }

  // Rate limit: Password changes (8 requests / minute)
  if (pathname === "/api/change-password" && req.method === "PUT") {
    const result = checkRateLimit(`rl:change-password:${ip}`, 8, 60_000);
    if (!result.allowed) return tooManyRequests();
  }

  // Rate limit: File imports (6 requests / minute)
  if (
    (pathname === "/api/import" ||
      pathname === "/api/kpi/import" ||
      pathname === "/api/cuoc/import" ||
      pathname === "/api/cuoc-cd/import") &&
    req.method === "POST"
  ) {
    const result = checkRateLimit(`rl:import:${pathname}:${ip}`, 6, 60_000);
    if (!result.allowed) return tooManyRequests();
  }

  // Block dangerous setup/seed routes if accidentally left behind
  if (pathname === "/api/seed" || pathname === "/api/setup") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
