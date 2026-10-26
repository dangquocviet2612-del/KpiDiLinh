import { canAccessAdvancedTools, ensureToolsSession } from "./_lib";
import { redirect } from "next/navigation";

export default async function ToolsPage() {
  const session = await ensureToolsSession();

  if (canAccessAdvancedTools(session.user.role)) {
    redirect("/tools/photo");
  }

  redirect("/tools/qr");
}
