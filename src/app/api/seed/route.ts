export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

function canRunSeed(request: Request) {
    const secret = process.env.SETUP_SECRET;
    if (!secret) return false;
    const url = new URL(request.url);
    const provided = request.headers.get("x-setup-secret") || url.searchParams.get("key");
    return provided === secret;
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!canRunSeed(request)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const seedUsername = process.env.SEED_ADMIN_USERNAME || "Vietdq9";
        const seedPassword = process.env.SEED_ADMIN_PASSWORD;
        if (!seedPassword || seedPassword.length < 12) {
            return NextResponse.json({ error: "Invalid seed configuration" }, { status: 400 });
        }

        const existingAdmin = await prisma.user.findUnique({
            where: { username: seedUsername }
        });

        if (existingAdmin) {
            return NextResponse.json({ message: "Admin account already exists." });
        }

        const hashedPassword = await bcrypt.hash(seedPassword, 10);
        const user = await prisma.user.create({
            data: {
                username: seedUsername,
                password: hashedPassword,
                role: "ADMIN"
            }
        });

        return NextResponse.json({ message: "Admin account created successfully", user: { username: user.username, role: user.role } });
    } catch (error) {
        console.error("SEED_ERROR", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}




