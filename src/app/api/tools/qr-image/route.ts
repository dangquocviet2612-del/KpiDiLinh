export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildBidvQrImageUrl,
  buildQrTransferContent,
  isValidQrContractNumber,
  normalizeQrAmount,
  normalizeQrContractNumber,
} from "@/lib/tools-qr";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const contract = normalizeQrContractNumber(searchParams.get("contract") || "");
  const amount = normalizeQrAmount(searchParams.get("amount") || "");
  const addInfo = String(searchParams.get("addInfo") || "");

  if (!isValidQrContractNumber(contract)) {
    return NextResponse.json({ error: "Số hợp đồng chưa hợp lệ" }, { status: 400 });
  }

  const qrUrl = buildBidvQrImageUrl(contract, { amount, addInfo });
  const qrResponse = await fetch(qrUrl, {
    cache: "no-store",
  });

  if (!qrResponse.ok) {
    return NextResponse.json({ error: "Không tải được ảnh QR từ VietQR" }, { status: 502 });
  }

  const arrayBuffer = await qrResponse.arrayBuffer();
  const contentDisposition = `attachment; filename=\"qr-bidv-${contract}.png\"`;
  const resolvedContent = buildQrTransferContent(addInfo, contract);
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": contentDisposition,
      "Cache-Control": "no-store",
      "X-QR-Contract": contract,
      "X-QR-AddInfo": encodeURIComponent(resolvedContent),
    },
  });
}
