import { auth } from "@/auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { Providers } from "@/components/Providers";
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

    const clientSession: Session = {
        expires: session.expires,
        user: {
            id: session.user.id,
            name: session.user.name ?? null,
            role: session.user.role,
            email: session.user.email ?? null,
            image: session.user.image ?? null,
        },
    };
    const sessionKey = JSON.stringify([clientSession.user.id, clientSession.user.name, clientSession.user.role]);

    return (
        <Providers key={sessionKey} session={clientSession}>
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
        </Providers>
    );
}
