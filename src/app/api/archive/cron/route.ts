export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { checkAndPurgeExpired } from "@/lib/archive";

function isAuthorized(request: Request) {
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.ARCHIVE_CRON_SECRET,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  if (allowedSecrets.length === 0) return false;

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
  const provided = (
    request.headers.get("x-archive-cron-secret") ||
    request.headers.get("x-cron-secret") ||
    bearerToken ||
    ""
  ).trim();

  return Boolean(provided && allowedSecrets.includes(provided));
}

async function runCron(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này" },
      { status: 401 }
    );
  }

  try {
    const count = await checkAndPurgeExpired();
    return NextResponse.json({ purgedCount: count });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể chạy cron purge lưu trữ" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
