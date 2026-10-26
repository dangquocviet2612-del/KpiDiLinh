import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CtvClient from "./CtvClient";

export const metadata = {
  title: "Quản lý CTV | CRM App",
  description: "Quản lý danh sách cộng tác viên",
};

export default async function CtvPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const params = (await searchParams) || {};
  return <CtvClient view={params.view || ""} />;
}
