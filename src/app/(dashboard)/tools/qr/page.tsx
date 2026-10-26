import { ensureQrToolAccess } from "../_lib";
import QrToolClient from "./QrToolClient";

export default async function ToolsQrPage() {
  await ensureQrToolAccess();

  return <QrToolClient />;
}
