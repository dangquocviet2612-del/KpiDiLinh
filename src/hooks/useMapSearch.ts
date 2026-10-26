"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface UseMapSearchOptions {
    endpoint: string;
    query: string;
    limit?: number;
    debounceMs?: number;
    enabled?: boolean;
}

export function useMapSearch<T>({
    endpoint,
    query,
    limit = 20,
    debounceMs = 300,
    enabled = true,
}: UseMapSearchOptions) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cacheRef = useRef<Map<string, T[]>>(new Map());

    const normalizedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        if (!enabled || !normalizedQuery) {
            setItems([]);
            setLoading(false);
            setError(null);
            return;
        }

        const cacheKey = `${endpoint}|${normalizedQuery}|${limit}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setItems(cached);
            setError(null);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);
                const url = `${endpoint}?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`;
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`Search failed: ${res.status}`);
                const data = await res.json();
                const nextItems = (data?.items ?? []) as T[];
                setItems(nextItems);
                cacheRef.current.set(cacheKey, nextItems);
            } catch (err: any) {
                if (err?.name === "AbortError") return;
                setError(err?.message || "Search error");
                setItems([]);
            } finally {
                setLoading(false);
            }
        }, debounceMs);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [endpoint, normalizedQuery, limit, debounceMs, enabled]);

    return { items, loading, error };
}
