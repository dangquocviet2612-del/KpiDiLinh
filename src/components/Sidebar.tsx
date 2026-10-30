"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Users, User, Map as MapIcon, LogOut, Moon, Sun, Menu, X, KeyRound, FolderClock, Network, Trophy, Archive, Wrench, ChevronRight, BarChart3, Receipt, FileText, Megaphone, Camera, QrCode, Calculator, Zap, CreditCard } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import styles from "./Sidebar.module.css";
import { cn } from "@/lib/utils";

function getRoleLabel(role: string) {
    if (role === "ADMIN") return "Admin";
    if (role === "MANAGER") return "Quản lý";
    if (role === "CTV") return "CTV";
    return role || "Người dùng";
}

function getInitials(userName: string) {
    const normalized = userName.trim();
    if (!normalized) return "CM";

    const parts = normalized.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }

    return normalized.slice(0, 2).toUpperCase();
}

export default function Sidebar({ userRole, userName }: { userRole: string; userName: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const prepaidView = pathname === "/prepaid" ? searchParams?.get("view") ?? "" : "";
    const isKpiRoute = pathname === "/prepaid";
    const isToolsRoute = pathname?.startsWith("/tools") ?? false;
    const [isKpiOpen, setIsKpiOpen] = useState(isKpiRoute);
    const [isToolsOpen, setIsToolsOpen] = useState(isToolsRoute);
    const [activeGroup, setActiveGroup] = useState<"kpi" | "tools" | null>(isToolsRoute ? "tools" : isKpiRoute ? "kpi" : null);
    const navRef = useRef<HTMLElement | null>(null);
    const sidebarRef = useRef<HTMLElement | null>(null);
    const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const kpiGroupRef = useRef<HTMLDivElement | null>(null);
    const toolsGroupRef = useRef<HTMLDivElement | null>(null);
    const suppressAutoOpenRef = useRef<"kpi" | "tools" | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const displayName = userName?.trim() || "Người dùng";
    const roleLabel = getRoleLabel(userRole);
    const userInitials = getInitials(displayName);
    const canViewSummary = userRole === "ADMIN" || userRole === "MANAGER";
    const canViewCuoc = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "CTV";
    const canViewKpiCalculator = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "CTV";

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
            setTheme("dark");
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            setTheme("light");
            document.documentElement.setAttribute("data-theme", "light");
        }
    }, []);

    useEffect(() => {
        if (!isMobileOpen) return;

        const mobileToggle = mobileToggleRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const frameId = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setIsMobileOpen(false);
                return;
            }

            if (event.key !== "Tab" || !sidebarRef.current) return;

            const focusableElements = Array.from(
                sidebarRef.current.querySelectorAll<HTMLElement>(
                    "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])"
                )
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement?.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement?.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            window.cancelAnimationFrame(frameId);
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            window.setTimeout(() => mobileToggle?.focus());
        };
    }, [isMobileOpen]);

    useEffect(() => {
        if (isKpiRoute) {
            if (suppressAutoOpenRef.current === "kpi") {
                suppressAutoOpenRef.current = null;
                return;
            }
            setIsKpiOpen(true);
            setIsToolsOpen(false);
            setActiveGroup("kpi");
        }
    }, [isKpiRoute]);

    useEffect(() => {
        if (isToolsRoute) {
            if (suppressAutoOpenRef.current === "tools") {
                suppressAutoOpenRef.current = null;
                return;
            }
            setIsToolsOpen(true);
            setIsKpiOpen(false);
            setActiveGroup("tools");
        }
    }, [isToolsRoute]);

    useEffect(() => {
        const navEl = navRef.current;
        const targetGroup = activeGroup === "kpi" ? kpiGroupRef.current : activeGroup === "tools" ? toolsGroupRef.current : null;
        if (!navEl || !targetGroup) {
            return;
        }

        if ((activeGroup === "kpi" && !isKpiOpen) || (activeGroup === "tools" && !isToolsOpen)) {
            return;
        }

        const scrollGroupIntoView = () => {
            const navRect = navEl.getBoundingClientRect();
            const groupRect = targetGroup.getBoundingClientRect();
            const overshootBottom = groupRect.bottom - navRect.bottom;
            const overshootTop = navRect.top - groupRect.top;
            const padding = 12;

            if (overshootBottom > 0) {
                navEl.scrollBy({ top: overshootBottom + padding, behavior: "smooth" });
                return;
            }

            if (overshootTop > 0) {
                navEl.scrollBy({ top: -(overshootTop + padding), behavior: "smooth" });
            }
        };

        const frameId = window.requestAnimationFrame(scrollGroupIntoView);
        const timeoutId = window.setTimeout(() => {
            window.requestAnimationFrame(scrollGroupIntoView);
        }, 220);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [activeGroup, isKpiOpen, isToolsOpen, pathname, prepaidView]);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    };

    const collapseSubmenus = () => {
        setIsKpiOpen(false);
        setIsToolsOpen(false);
        setActiveGroup(null);
    };

    const closeSubmenuAfterNavigation = (group: "kpi" | "tools") => {
        suppressAutoOpenRef.current = group;
        if (group === "kpi") {
            setIsKpiOpen(false);
        } else {
            setIsToolsOpen(false);
        }
        setActiveGroup(null);
        setIsMobileOpen(false);
    };

    const navLinks = [
        { href: "/customers", label: "Khách hàng", icon: <Users size={20} /> },
        { href: "/map", label: "Bản đồ", icon: <MapIcon size={20} /> },
        { href: "/node-map", label: "Bản đồ Node", icon: <Network size={20} /> },
        { href: "/node-0tb", label: "Node 0TB", icon: <Zap size={20} /> },
    ];

    if (userRole === "ADMIN") {
        navLinks.push({ href: "/ctv", label: "CTV", icon: <Users size={20} /> });
        navLinks.push({ href: "/logs", label: "Nhật ký", icon: <FolderClock size={20} /> });
        navLinks.push({ href: "/archive", label: "Lưu trữ", icon: <Archive size={20} /> });
    }

    return (
        <>
            <button
                ref={mobileToggleRef}
                type="button"
                className={styles.mobileToggle}
                onClick={() => setIsMobileOpen(true)}
                aria-label="Mở menu điều hướng"
                aria-controls="dashboard-navigation"
                aria-expanded={isMobileOpen}
                title="Mở menu điều hướng"
            >
                <Menu size={24} />
            </button>

            {isMobileOpen && (
                <div className={styles.overlay} onClick={() => setIsMobileOpen(false)} />
            )}

            <aside
                ref={sidebarRef}
                id="dashboard-navigation"
                className={cn(styles.sidebar, isMobileOpen && styles.open)}
                role={isMobileOpen ? "dialog" : undefined}
                aria-modal={isMobileOpen || undefined}
                aria-label={isMobileOpen ? "Menu điều hướng" : undefined}
            >
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>{userInitials}</div>
                        <div className={styles.headerText}>
                            <p className={styles.headerEyebrow}>CRM App</p>
                            <h2 className={styles.title} title={displayName}>{displayName}</h2>
                            <p className={styles.roleBadge}>{roleLabel}</p>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className={styles.closeBtn}
                        onClick={() => setIsMobileOpen(false)}
                        aria-label="Đóng menu điều hướng"
                        title="Đóng menu điều hướng"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav ref={navRef} className={styles.nav}>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => {
                                collapseSubmenus();
                                setIsMobileOpen(false);
                            }}
                            aria-current={pathname === link.href ? "page" : undefined}
                            className={cn(styles.navLink, pathname === link.href && styles.active)}
                        >
                            <span className={styles.icon}>{link.icon}</span>
                            {link.label}
                        </Link>
                    ))}

                    <div ref={kpiGroupRef} className={styles.navGroup}>
                        <div className={cn(styles.navGroupHeader, (isKpiRoute || isKpiOpen) && styles.navGroupHeaderActive)}>
                            <Link
                                href="/prepaid"
                                onClick={() => {
                                    setIsToolsOpen(false);
                                    setActiveGroup("kpi");
                                    setIsMobileOpen(false);
                                }}
                                className={cn(styles.navLink, styles.navGroupMainLink)}
                            >
                                <span className={styles.icon}><Trophy size={20} /></span>
                                KPI
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsKpiOpen((current) => {
                                        const next = !current;
                                        if (next) {
                                            setIsToolsOpen(false);
                                            setActiveGroup("kpi");
                                        }
                                        return next;
                                    });
                                }}
                                aria-label={isKpiOpen ? "Thu gọn menu KPI" : "Mở menu KPI"}
                                aria-expanded={isKpiOpen}
                                className={styles.navGroupToggle}
                            >
                                <ChevronRight size={16} className={cn(styles.chevronIcon, isKpiOpen && styles.chevronOpen)} />
                            </button>
                        </div>

                        <div
                            className={cn(styles.submenu, isKpiOpen && styles.submenuOpen)}
                            aria-hidden={!isKpiOpen}
                        >
                            <Link
                                href="/prepaid"
                                onClick={() => closeSubmenuAfterNavigation("kpi")}
                                aria-current={isKpiRoute && prepaidView === "" ? "page" : undefined}
                                className={cn(styles.submenuLink, isKpiRoute && prepaidView === "" && styles.submenuLinkActive)}
                            >
                                <span className={styles.submenuIcon}><User size={14} /></span>
                                Cá nhân
                            </Link>
                            {canViewKpiCalculator && (
                                <Link
                                    href="/prepaid?view=kpi-calculator"
                                    onClick={() => closeSubmenuAfterNavigation("kpi")}
                                    aria-current={isKpiRoute && prepaidView === "kpi-calculator" ? "page" : undefined}
                                    className={cn(styles.submenuLink, isKpiRoute && prepaidView === "kpi-calculator" && styles.submenuLinkActive)}
                                >
                                    <span className={styles.submenuIcon}><Calculator size={14} /></span>
                                    Tính KPI
                                </Link>
                            )}
                            {canViewSummary && (
                                <Link
                                    href="/prepaid?view=summary"
                                    onClick={() => closeSubmenuAfterNavigation("kpi")}
                                    aria-current={isKpiRoute && prepaidView === "summary" ? "page" : undefined}
                                    className={cn(styles.submenuLink, isKpiRoute && prepaidView === "summary" && styles.submenuLinkActive)}
                                >
                                    <span className={styles.submenuIcon}><BarChart3 size={14} /></span>
                                    Tổng hợp
                                </Link>
                            )}
                            {canViewSummary && (
                                <Link
                                    href="/prepaid?view=summary-manager"
                                    onClick={() => closeSubmenuAfterNavigation("kpi")}
                                    aria-current={isKpiRoute && prepaidView === "summary-manager" ? "page" : undefined}
                                    className={cn(styles.submenuLink, isKpiRoute && prepaidView === "summary-manager" && styles.submenuLinkActive)}
                                >
                                    <span className={styles.submenuIcon}><Trophy size={14} /></span>
                                    KPI Qly
                                </Link>
                            )}
                            {canViewCuoc && (
                                <Link
                                    href="/prepaid?view=cuoc"
                                    onClick={() => closeSubmenuAfterNavigation("kpi")}
                                    aria-current={isKpiRoute && prepaidView === "cuoc" ? "page" : undefined}
                                    className={cn(styles.submenuLink, isKpiRoute && prepaidView === "cuoc" && styles.submenuLinkActive)}
                                >
                                    <span className={styles.submenuIcon}><Receipt size={14} /></span>
                                    Cước
                                </Link>
                            )}
                            {canViewCuoc && (
                                <Link
                                    href="/prepaid?view=cuoc-cd"
                                    onClick={() => closeSubmenuAfterNavigation("kpi")}
                                    aria-current={isKpiRoute && prepaidView === "cuoc-cd" ? "page" : undefined}
                                    className={cn(styles.submenuLink, isKpiRoute && prepaidView === "cuoc-cd" && styles.submenuLinkActive)}
                                >
                                    <span className={styles.submenuIcon}><Receipt size={14} /></span>
                                    Cước CD
                                </Link>
                            )}
                            <Link
                                href="/prepaid?view=cdt"
                                onClick={() => closeSubmenuAfterNavigation("kpi")}
                                aria-current={isKpiRoute && prepaidView === "cdt" ? "page" : undefined}
                                className={cn(styles.submenuLink, isKpiRoute && prepaidView === "cdt" && styles.submenuLinkActive)}
                            >
                                <span className={styles.submenuIcon}><FileText size={14} /></span>
                                CDT
                            </Link>
                            <Link
                                href="/prepaid?view=official-docs"
                                onClick={() => closeSubmenuAfterNavigation("kpi")}
                                aria-current={isKpiRoute && prepaidView === "official-docs" ? "page" : undefined}
                                className={cn(
                                    styles.submenuLink,
                                    isKpiRoute && prepaidView === "official-docs" && styles.submenuLinkActive
                                )}
                            >
                                <span className={styles.submenuIcon}><Megaphone size={14} /></span>
                                Công văn
                            </Link>
                        </div>
                    </div>

                    {userRole && (
                        <div ref={toolsGroupRef} className={styles.navGroup}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsToolsOpen((current) => {
                                        const next = !current;
                                        if (next) {
                                            setIsKpiOpen(false);
                                            setActiveGroup("tools");
                                        }
                                        return next;
                                    });
                                }}
                                aria-expanded={isToolsOpen}
                                className={cn(styles.navLink, styles.navButton, (isToolsRoute || isToolsOpen) && styles.active)}
                            >
                                <span className={styles.icon}><Wrench size={20} /></span>
                                <span className={styles.navButtonLabel}>Tiện ích</span>
                                <span className={styles.navChevron}>
                                    <ChevronRight size={16} className={cn(styles.chevronIcon, isToolsOpen && styles.chevronOpen)} />
                                </span>
                            </button>

                            <div
                                className={cn(styles.submenu, isToolsOpen && styles.submenuOpen)}
                                aria-hidden={!isToolsOpen}
                            >
                                {[
                                    ...(userRole === "ADMIN" || userRole === "MANAGER"
                                      ? [
                                          { href: "/tools/photo", label: "Sửa ảnh", icon: <Camera size={14} /> },
                                        ]
                                      : []),
                                    { href: "/tools/qr", label: "Tạo QR", icon: <QrCode size={14} /> },
                                    { href: "/tools/sim", label: "Ghi Sim", icon: <CreditCard size={14} /> },
                                ].map((tool) => (
                                    <Link
                                        key={tool.href}
                                        href={tool.href}
                                        onClick={() => closeSubmenuAfterNavigation("tools")}
                                        aria-current={pathname === tool.href ? "page" : undefined}
                                        className={cn(styles.submenuLink, pathname === tool.href && styles.submenuLinkActive)}
                                    >
                                        <span className={styles.submenuIcon}>{tool.icon}</span>
                                        {tool.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                <div className={styles.footer}>
                    <Link
                        href="/change-password"
                        onClick={() => {
                            collapseSubmenus();
                            setIsMobileOpen(false);
                        }}
                        aria-current={pathname === "/change-password" ? "page" : undefined}
                        className={cn(styles.navLink, pathname === "/change-password" && styles.active)}
                    >
                        <span className={styles.icon}><KeyRound size={20} /></span>
                        Đổi mật khẩu
                    </Link>

                    <button onClick={toggleTheme} className={styles.navLink}>
                        <span className={styles.icon}>
                            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                        </span>
                        {theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
                    </button>

                    <button onClick={() => signOut({ callbackUrl: '/login' })} className={cn(styles.navLink, styles.logout)}>
                        <span className={styles.icon}><LogOut size={20} /></span>
                        Đăng xuất
                    </button>
                </div>
            </aside>
        </>
    );
}
