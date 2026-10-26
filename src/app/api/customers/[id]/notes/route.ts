export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessCustomerByCtvCode } from "@/lib/scope";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const customer = await prisma.customer.findUnique({ where: { id } });
        if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const canAccess = await canAccessCustomerByCtvCode(session, customer.ctvCode);
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const notes = await prisma.customerNote.findMany({
            where: { customerId: id },
            include: { user: { select: { username: true } } },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(notes);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const customer = await prisma.customer.findUnique({ where: { id } });
        if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const canAccess = await canAccessCustomerByCtvCode(session, customer.ctvCode);
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        if (!body.content || !body.content.trim()) {
            return NextResponse.json({ error: "Nội dung ghi chú không được để trống" }, { status: 400 });
        }

        const note = await prisma.customerNote.create({
            data: {
                customerId: id,
                userId: session.user.id,
                content: body.content.trim(),
            },
            include: { user: { select: { username: true } } },
        });

        return NextResponse.json(note);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await params;
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        if (!body.noteId) {
            return NextResponse.json({ error: "noteId is required" }, { status: 400 });
        }

        const note = await prisma.customerNote.findUnique({ where: { id: body.noteId } });
        if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

        // Only ADMIN or the note creator can delete
        if (session.user.role !== "ADMIN" && note.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.customerNote.delete({ where: { id: body.noteId } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
