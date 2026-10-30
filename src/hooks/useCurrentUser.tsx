"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CurrentUserRequestBroker, type CurrentUser, type CurrentUserRequestError } from "@/lib/current-user-request";

type CurrentUserScope = { key: string; broker: CurrentUserRequestBroker };
const CurrentUserContext = createContext<CurrentUserScope | null | undefined>(undefined);

function useSessionIdentity() {
    const { data: session, status } = useSession();
    const id = status !== "unauthenticated" ? session?.user?.id || null : null;
    const key = id ? JSON.stringify([id, session?.user?.name || "", session?.user?.role || ""]) : "";
    return { id, key };
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
    const { id, key } = useSessionIdentity();
    const scope = useMemo(() => id ? { key, broker: new CurrentUserRequestBroker(id) } : null, [id, key]);
    useEffect(() => () => scope?.broker.abortAll(), [scope]);
    return <CurrentUserContext.Provider value={scope}>{children}</CurrentUserContext.Provider>;
}

type QueryState = {
    scope: CurrentUserScope | null;
    data: CurrentUser | null;
    error: CurrentUserRequestError | null;
    loading: boolean;
};

export function useCurrentUser(enabled = true) {
    const inherited = useContext(CurrentUserContext);
    const { id, key } = useSessionIdentity();
    const isolated = useMemo(() => inherited === undefined && id ?
        { key, broker: new CurrentUserRequestBroker(id) } : null, [id, inherited, key]);
    const scope = enabled ? (inherited === undefined ? isolated : inherited) : null;
    const [state, setState] = useState<QueryState>({ scope, data: null, error: null, loading: Boolean(scope) });
    const recheck = useRef<{ scope: CurrentUserScope; refresh: () => void } | null>(null);

    useEffect(() => () => isolated?.broker.abortAll(), [isolated]);

    useEffect(() => {
        if (!scope) return;
        let active = true;
        let controller: AbortController | null = null;
        let pending: Promise<void> | null = null;
        const refresh = () => {
            if (!active || pending) return;
            controller = new AbortController();
            const signal = controller.signal;
            setState((current) => ({ scope, data: current.scope === scope ? current.data : null, error: null, loading: true }));
            const task = scope.broker.request(signal).then((data) => {
                if (active && !signal.aborted) setState({ scope, data, error: null, loading: false });
            }, (error: CurrentUserRequestError) => {
                if (active && !signal.aborted) setState({ scope, data: null, error, loading: false });
            }).finally(() => {
                if (pending === task) pending = null;
            });
            pending = task;
        };
        const subscription = { scope, refresh };
        recheck.current = subscription;
        const visible = () => { if (document.visibilityState === "visible") refresh(); };
        document.addEventListener("visibilitychange", visible);
        window.addEventListener("focus", visible);
        window.addEventListener("online", refresh);
        refresh();
        return () => {
            active = false;
            if (recheck.current === subscription) recheck.current = null;
            document.removeEventListener("visibilitychange", visible);
            window.removeEventListener("focus", visible);
            window.removeEventListener("online", refresh);
            controller?.abort();
        };
    }, [scope]);

    const refresh = useCallback(() => {
        if (recheck.current?.scope === scope) recheck.current?.refresh();
    }, [scope]);

    return {
        data: scope && state.scope === scope ? state.data : null,
        error: scope && state.scope === scope ? state.error : null,
        loading: Boolean(scope) && (state.scope !== scope || state.loading),
        refresh,
        scope,
    };
}
