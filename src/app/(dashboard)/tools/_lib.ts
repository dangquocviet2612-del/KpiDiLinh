import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function ensureToolsSession() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export function canAccessAdvancedTools(role?: string | null) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function ensureToolsAccess() {
  const session = await ensureToolsSession();

  if (!canAccessAdvancedTools(session.user.role)) {
    redirect("/");
  }

  return session;
}

export async function ensureQrToolAccess() {
  return ensureToolsSession();
}

export async function ensureSimToolAccess() {
  return ensureToolsSession();
}
