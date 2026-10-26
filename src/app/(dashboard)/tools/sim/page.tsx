import { ensureSimToolAccess } from "../_lib";
import SimToolClient from "./SimToolClient";

export default async function ToolsSimPage() {
  const session = await ensureSimToolAccess();
  const isAdmin = session?.user?.role === "ADMIN";

  return <SimToolClient isAdmin={isAdmin} />;
}
