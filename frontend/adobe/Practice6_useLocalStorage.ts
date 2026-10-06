import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const readInitial = (): T => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [value, setValue] = useState<T>(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors (quota/private mode)
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Usage example:
 * const [theme, setTheme] = useLocalStorage<string>("theme", "light");
 */
