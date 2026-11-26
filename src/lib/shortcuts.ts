// The explorers' playback keys (Space, ←/→, R, protocol's V and Esc) on UI SDK's
// shortcuts: one key listener for the page, paused while a modal sheet is
// open, never run while typing in a field or when a press already handled
// the key (a tab's or a slider's arrows, a menu's Escape).
import { shortcuts } from "@ui-sdk/react/shortcuts";
import { useEffect, useRef } from "react";

/** Focus on one of these keeps its own keys: Space presses a button, not play. */
export const CONTROLS = "input,select,textarea,button,a,summary,[role='button']";

export interface KeyBinding {
  /** UI SDK keys, like "arrowright". Shift with the same key runs it too. */
  keys: string;
  run: () => void;
  /** Run again while the key is held (the default), or once per press. */
  repeat?: boolean;
  description?: string;
}

/**
 * Registers the bindings while the component is mounted. They run only while
 * `enabled` is (or returns) true and focus is not on an element matching `ignore`.
 * The latest `run`s and `enabled` are read on each press.
 */
export function useExplorerShortcuts(
  bindings: KeyBinding[],
  {
    enabled = true,
    ignore = CONTROLS,
  }: { enabled?: boolean | (() => boolean); ignore?: string } = {},
) {
  const latest = useRef({ bindings, enabled, ignore });
  useEffect(() => {
    latest.current = { bindings, enabled, ignore };
  });
  const signature = bindings
    .map((b) => `${b.keys}:${b.repeat !== false}:${b.description ?? ""}`)
    .join("|");
  useEffect(() => {
    const when = () => {
      const { enabled, ignore } = latest.current;
      const on = typeof enabled === "function" ? enabled() : enabled;
      return on && !document.activeElement?.closest(ignore);
    };
    const offs = latest.current.bindings.flatMap((binding, i) => {
      const run = () => latest.current.bindings[i]?.run();
      const options = {
        when,
        repeat: binding.repeat !== false,
        description: binding.description,
      };
      return [
        shortcuts.register(binding.keys, run, options),
        shortcuts.register(`shift+${binding.keys}`, run, { ...options, description: undefined }),
      ];
    });
    return () => offs.forEach((off) => off());
  }, [signature]);
}
