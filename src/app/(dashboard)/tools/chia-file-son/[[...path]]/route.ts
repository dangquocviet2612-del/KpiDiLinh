import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const TOOL_ROOT = path.join(process.cwd(), "tool-assets", "chia-file-son");

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

function isAuthorized(role?: string | null) {
    return role === "ADMIN" || role === "MANAGER";
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ path?: string[] }> }
) {
    const session = await auth();

    if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!isAuthorized(session.user.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { path: requestedParts = [] } = await context.params;
    const relativePath = requestedParts.length > 0 ? requestedParts.join("/") : "index.html";
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = path.join(TOOL_ROOT, normalizedPath);

    if (!absolutePath.startsWith(TOOL_ROOT)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const fileBuffer = await fs.readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": extension === ".html" ? "no-store" : "private, max-age=3600",
            },
        });
    } catch {
        return new NextResponse("Not Found", { status: 404 });
    }
}
