import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export type AllowedRole = "ADMIN" | "MANAGER" | "CTV";

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: AllowedRole;
  canUseGps?: boolean;
  managerCode?: string | null;
  secondaryCode?: string | null;
}

export interface RequireAuthOptions {
  roles?: AllowedRole[];
  requireGps?: boolean;
}

export type AuthResult =
  | {
      errorResponse: null;
      user: AuthenticatedUser;
      session: Session;
    }
  | {
      errorResponse: NextResponse;
      user: null;
      session: null;
    };

/**
 * Standardized authentication & authorization guard for Next.js Route Handlers.
 * Enforces valid session, role-based access control, and optional feature flags (like GPS access).
 */
export async function requireAuth(options?: RequireAuthOptions): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.role) {
    return {
      errorResponse: NextResponse.json(
        { error: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn" },
        { status: 401 }
      ),
      user: null,
      session: null,
    };
  }

  const role = session.user.role as AllowedRole;
  const username = session.user.name || "";

  if (options?.roles && !options.roles.includes(role)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      ),
      user: null,
      session: null,
    };
  }

  let canUseGps: boolean | undefined;
  let managerCode: string | null | undefined;
  let secondaryCode: string | null | undefined;

  if (options?.requireGps) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { canUseGps: true, managerCode: true, secondaryCode: true },
      });
      if (dbUser) {
        canUseGps = dbUser.canUseGps;
        managerCode = dbUser.managerCode;
        secondaryCode = dbUser.secondaryCode;
      }
    } catch {
      // Fallback
    }

    if (canUseGps !== true) {
      return {
        errorResponse: NextResponse.json(
          { error: "Tài khoản của bạn chưa được cấp quyền sử dụng tính năng GPS tọa độ." },
          { status: 403 }
        ),
        user: null,
        session: null,
      };
    }
  }

  const user: AuthenticatedUser = {
    id: session.user.id,
    name: username,
    username,
    role,
    canUseGps,
    managerCode,
    secondaryCode,
  };

  return {
    errorResponse: null,
    user,
    session,
  };
}
