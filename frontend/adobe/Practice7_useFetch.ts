import { useCallback, useEffect, useRef, useState } from "react";

type UseFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useFetch<T>(url: string, immediate: boolean = true) {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = (await res.json()) as T;
      setState({ data, loading: false, error: null });
      return data;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      setState((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
      return null;
    }
  }, [url]);

  useEffect(() => {
    if (immediate) {
      void execute();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [execute, immediate]);

  return {
    ...state,
    refetch: execute,
  };
}

/**
 * Usage example:
 * const { data, loading, error, refetch } = useFetch<User[]>("/api/users");
 */
