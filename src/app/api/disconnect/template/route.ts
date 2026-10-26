export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildDisconnectTemplateBuffer,
  getDisconnectTemplateFileName,
  normalizeDisconnectSourceType,
  DISCONNECT_SOURCE_TV,
} from "@/lib/disconnect";

export async function GET(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
  }

  const sourceType = normalizeDisconnectSourceType(new URL(request.url).searchParams.get("sourceType")) || DISCONNECT_SOURCE_TV;
  const buffer = buildDisconnectTemplateBuffer(sourceType);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${getDisconnectTemplateFileName(sourceType)}"`,
      "Cache-Control": "no-store",
    },
  });
}
