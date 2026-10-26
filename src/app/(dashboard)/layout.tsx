import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardScrollTop from "@/components/DashboardScrollTop";
import styles from "./layout.module.css";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session || !session.user) {
        redirect("/login");
    }

    return (
        <div className={styles.container}>
            <a className="app-skip-link" href="#dashboard-main">
                Chuyển đến nội dung chính
            </a>
            <Sidebar userRole={session.user.role || ""} userName={session.user.name || ""} />
            <main id="dashboard-main" className={styles.main} data-dashboard-main tabIndex={-1}>
                {children}
                <DashboardScrollTop />
            </main>
        </div>
    );
}
