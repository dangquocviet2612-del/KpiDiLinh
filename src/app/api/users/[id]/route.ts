export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { userUpdateSchema } from "@/lib/validations/user.schema";
import { recordAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { invalidateCacheForMutation } from "@/lib/cache-tags";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";

async function ensureManagerCodeColumn() {
    await ensureRuntimeSchema("users");
}

// PUT update a User (Admin only)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    let writeCommitted = false;
    try {
        const { id } = await params;
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;

        const rawBody = await request.json();
        const parseResult = userUpdateSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map((e) => e.message).join(", ");
            return NextResponse.json({ error: errorDetails }, { status: 422 });
        }

        const { username, password, role, canUseGps, managerCode, secondaryCode } = parseResult.data;

        await ensureManagerCodeColumn();

        const updateData: any = {};

        if (username !== undefined && username !== "") updateData.username = username;
        if (role !== undefined) updateData.role = role;
        if (canUseGps !== undefined) updateData.canUseGps = canUseGps === true;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        let updatedUser: any;
        try {
            if (managerCode !== undefined) updateData.managerCode = managerCode || null;
            if (secondaryCode !== undefined) updateData.secondaryCode = secondaryCode || null;
            updatedUser = await prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    username: true,
                    role: true,
                    managerCode: true,
                    secondaryCode: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            writeCommitted = Object.keys(updateData).length > 0;
        } catch {
            const fallbackData = { ...updateData };
            delete fallbackData.managerCode;
            delete fallbackData.secondaryCode;
            updatedUser = await prisma.user.update({
                where: { id },
                data: fallbackData,
                select: {
                    id: true,
                    username: true,
                    role: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            writeCommitted = Object.keys(fallbackData).length > 0;
            if (managerCode !== undefined) {
                const affectedRows = await prisma.$executeRawUnsafe(
                    `UPDATE "User" SET managerCode = ? WHERE id = ?`,
                    managerCode ? String(managerCode) : null,
                    String(id)
                );
                if (affectedRows > 0) writeCommitted = true;
                (updatedUser as any).managerCode = managerCode ? String(managerCode) : null;
            } else {
                (updatedUser as any).managerCode = null;
            }
            if (secondaryCode !== undefined) {
                const affectedRows = await prisma.$executeRawUnsafe(
                    `UPDATE "User" SET secondaryCode = ? WHERE id = ?`,
                    secondaryCode ? String(secondaryCode) : null,
                    String(id)
                );
                if (affectedRows > 0) writeCommitted = true;
                (updatedUser as any).secondaryCode = secondaryCode ? String(secondaryCode) : null;
            } else {
                (updatedUser as any).secondaryCode = null;
            }
        }

        if (writeCommitted) {
            invalidateCacheForMutation("users");
            writeCommitted = false;
        }

        await recordAuditLog({
            userId: authResult.user.id,
            username: authResult.user.username,
            action: "USER_UPDATE",
            resource: "User",
            details: {
                targetUserId: id,
                targetUsername: updatedUser.username,
                role: updatedUser.role,
                canUseGps: updatedUser.canUseGps,
                managerCode: (updatedUser as any).managerCode,
            },
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || "Lỗi cập nhật người dùng" }, { status: 500 });
    } finally {
        if (writeCommitted) invalidateCacheForMutation("users");
    }
}

// DELETE a User (Admin only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;

        if (id === authResult.user.id) {
            return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình" }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true, username: true, role: true }
        });
        if (!existingUser) {
            return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
        }

        await prisma.user.delete({
            where: { id }
        });

        invalidateCacheForMutation("users");

        await recordAuditLog({
            userId: authResult.user.id,
            username: authResult.user.username,
            action: "USER_DELETE",
            resource: "User",
            details: {
                deletedUserId: existingUser.id,
                deletedUsername: existingUser.username,
                role: existingUser.role,
            },
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });

        return NextResponse.json({ success: true, message: `Đã xóa người dùng ${existingUser.username}` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Lỗi xóa người dùng" }, { status: 500 });
    }
}
