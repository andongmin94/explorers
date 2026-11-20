// The window: one explorer page. Holds the lesson-drawer state the toolbar's
// "레슨" key and the rail share, and closes the drawer on Escape or when the
// window grows past the drawer breakpoint.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn.ts";
import { useMediaQuery } from "@/lib/use-media-query.ts";

interface RailState {
  open: boolean;
  /** True below 1280px, where the rail is a drawer. */
  drawer: boolean;
  setOpen: (open: boolean) => void;
}

const RailContext = createContext<RailState | null>(null);
const RailButtonContext = createContext<React.RefObject<HTMLButtonElement | null> | null>(null);

/** The toolbar's "레슨" key: the rail returns focus to it when the drawer closes. */
export function useRailButton() {
  const ref = useContext(RailButtonContext);
  if (!ref) throw new Error("useRailButton() needs <ExplorerPage>");
  return ref;
}

export function useRail(): RailState {
  const rail = useContext(RailContext);
  if (!rail) throw new Error("useRail() needs <ExplorerPage>");
  return rail;
}

export const DRAWER_QUERY = "(max-width: 1279px)";

// ?backdrop=1: the optional wallpaper wash behind the scene (a draft, off by
// default; backdrop-wash in app.css). Read once, before the first paint.
if (
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("backdrop") === "1"
)
  document.documentElement.dataset.backdrop = "on";

/** The page: toolbar, console, footer and sheets go inside. */
export function ExplorerPage({ className, children }: { className?: string; children: ReactNode }) {
  const drawer = useMediaQuery(DRAWER_QUERY);
  const [open, setOpenState] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const setOpen = useCallback(
    (next: boolean) => setOpenState(next && window.matchMedia(DRAWER_QUERY).matches),
    [],
  );

  // The drawer closes when the window crosses the breakpoint either way.
  useEffect(() => {
    const list = window.matchMedia(DRAWER_QUERY);
    const close = () => setOpenState(false);
    list.addEventListener("change", close);
    return () => list.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpenState(false);
      button.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const rail = useMemo(() => ({ open: open && drawer, drawer, setOpen }), [open, drawer, setOpen]);
  return (
    <RailButtonContext.Provider value={button}>
      <RailContext.Provider value={rail}>
        <div
          data-rail-open={rail.open || undefined}
          className={cn(
            "explorer-page backdrop-wash bg-window font-sans text-label [font-synthesis-weight:none]",
            className,
          )}
        >
          {children}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className={cn(
              "fixed inset-0 z-[55] bg-black/16 opacity-0 transition-opacity duration-250 motion-reduce:transition-none rail-column:hidden",
              rail.open ? "pointer-events-auto opacity-100" : "pointer-events-none",
            )}
          />
        </div>
      </RailContext.Provider>
    </RailButtonContext.Provider>
  );
}
