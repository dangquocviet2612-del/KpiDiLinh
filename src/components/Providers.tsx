"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
    return (
        <SessionProvider session={session}>
            <CurrentUserProvider>
                <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            </CurrentUserProvider>
        </SessionProvider>
    );
}
