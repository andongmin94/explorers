// Light / dark theme. The page's inline script in index.html sets
// <html data-theme> (and .dark) before first paint from localStorage or the
// system setting; useTheme() reads and toggles it.
import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const storeKey = (explorer: string) => `${explorer}-explorer:theme`;

/** Apply a theme to <html>: data-theme for the tokens, .dark for Tailwind's dark: variant. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

const listeners = new Set<() => void>();
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** [theme, toggle]: toggle flips the theme and remembers it for this explorer. */
export function useTheme(explorer: string): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const toggle = useCallback(() => {
    const next: Theme = read() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(storeKey(explorer), next);
    } catch {
      /* private mode: keep it for this visit */
    }
    for (const listener of listeners) listener();
  }, [explorer]);
  return [theme, toggle];
}
