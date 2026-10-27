import { useCallback, useEffect, useRef } from "react";

type RequestOptions<Payload> = {
  key: string;
  force?: boolean;
  load: (signal: AbortSignal) => Promise<Payload>;
  resolvedKeys?: (data: Payload) => string[];
  onStart: () => void;
  onSuccess: (data: Payload) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

type ActiveRequest = {
  key: string;
  controller: AbortController;
  promise: Promise<void>;
};

export function kpiReportRequestKey(scope: string, ctv: string, date: string) {
  return JSON.stringify([scope, ctv, date]);
}

export function useLatestKpiRequest<Payload>() {
  const activeRef = useRef<ActiveRequest | null>(null);
  const completedRef = useRef({ keys: new Set<string>(), at: 0 });

  const cancel = useCallback(() => {
    activeRef.current?.controller.abort();
    activeRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    completedRef.current = { keys: new Set(), at: 0 };
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  const run = useCallback((options: RequestOptions<Payload>): Promise<void> => {
    const active = activeRef.current;
    if (active?.key === options.key && !active.controller.signal.aborted) return active.promise;

    cancel();
    if (!options.force && completedRef.current.keys.has(options.key) && Date.now() - completedRef.current.at < 10_000) {
      options.onStart();
      options.onSettled();
      return Promise.resolve();
    }

    const request: ActiveRequest = { key: options.key, controller: new AbortController(), promise: Promise.resolve() };
    activeRef.current = request;
    request.promise = Promise.resolve().then(async () => {
      if (activeRef.current !== request || request.controller.signal.aborted) return;
      options.onStart();
      try {
        const data = await options.load(request.controller.signal);
        if (activeRef.current !== request || request.controller.signal.aborted) return;
        completedRef.current = { keys: new Set([options.key, ...(options.resolvedKeys?.(data) || [])]), at: Date.now() };
        options.onSuccess(data);
      } catch (error) {
        if (activeRef.current === request && !request.controller.signal.aborted) options.onError(error);
      } finally {
        if (activeRef.current === request) {
          activeRef.current = null;
          options.onSettled();
        }
      }
    });
    return request.promise;
  }, [cancel]);

  return { run, cancel, reset };
}
