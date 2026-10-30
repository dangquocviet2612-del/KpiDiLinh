import type { CtvUser } from "@/types";

export type CurrentUser = {
    id: string;
    username: string;
    role: string;
    canUseGps: boolean;
    ctvList: CtvUser[];
};

export class CurrentUserRequestError extends Error {
    constructor(message: string, public readonly status: number | null = null) {
        super(message);
        this.name = "CurrentUserRequestError";
    }
}

type Subscriber = {
    resolve: (data: CurrentUser) => void;
    reject: (error: Error) => void;
    detach: () => void;
};

type PendingRequest = {
    controller: AbortController;
    subscribers: Set<Subscriber>;
};

const abortError = () => new DOMException("Current-user request cancelled", "AbortError");

export class CurrentUserRequestBroker {
    private pending: PendingRequest | null = null;
    private disposed = false;

    constructor(private readonly expectedUserId: string) {}

    request(signal?: AbortSignal): Promise<CurrentUser> {
        if (this.disposed || signal?.aborted) return Promise.reject(abortError());
        const entry = this.pending || { controller: new AbortController(), subscribers: new Set<Subscriber>() };
        const start = this.pending !== entry;
        this.pending = entry;
        return new Promise((resolve, reject) => {
            const cancel = () => {
                subscriber.detach();
                entry.subscribers.delete(subscriber);
                reject(abortError());
                if (this.pending === entry && entry.subscribers.size === 0) this.cancel(entry);
            };
            const subscriber: Subscriber = {
                resolve,
                reject,
                detach: () => signal?.removeEventListener("abort", cancel),
            };
            entry.subscribers.add(subscriber);
            signal?.addEventListener("abort", cancel, { once: true });
            if (start) void this.load(entry);
        });
    }

    abortAll() {
        if (this.pending) this.cancel(this.pending);
    }

    dispose() {
        this.disposed = true;
        this.abortAll();
    }

    private cancel(entry: PendingRequest) {
        if (this.pending === entry) this.pending = null;
        entry.controller.abort();
        for (const subscriber of entry.subscribers) {
            subscriber.detach();
            subscriber.reject(abortError());
        }
        entry.subscribers.clear();
    }

    private settle(entry: PendingRequest, data: CurrentUser | null, error?: CurrentUserRequestError) {
        if (this.pending !== entry || entry.controller.signal.aborted) return;
        this.pending = null;
        for (const subscriber of entry.subscribers) {
            subscriber.detach();
            if (error) subscriber.reject(error);
            else subscriber.resolve(data!);
        }
        entry.subscribers.clear();
    }

    private async load(entry: PendingRequest) {
        try {
            const response = await fetch("/api/me", { method: "GET", signal: entry.controller.signal });
            if (this.pending !== entry || entry.controller.signal.aborted) return;
            if (!response.ok) throw new CurrentUserRequestError("Current-user request failed", response.status);
            let data: CurrentUser;
            try {
                data = await response.json();
            } catch (error) {
                throw new CurrentUserRequestError(error instanceof Error ? error.message : "Invalid current-user JSON");
            }
            if (!data || data.id !== this.expectedUserId) {
                throw new CurrentUserRequestError("Current-user subject does not match the authenticated session", response.status);
            }
            this.settle(entry, data);
        } catch (error) {
            this.settle(entry, null, error instanceof CurrentUserRequestError ? error :
                new CurrentUserRequestError(error instanceof Error ? error.message : "Current-user network failure"));
        }
    }
}
