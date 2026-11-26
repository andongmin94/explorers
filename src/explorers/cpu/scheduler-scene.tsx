// The stage scene: React owns the host element, the imperative scene
// (scene.ts) owns everything inside it. Mount once, hand the scene to the
// playback controller, and translate clicks/keys on tokens into selection.
import { useLayoutEffect, useRef } from "react";

import { sceneBoxClass } from "@/components/shell/console.tsx";
import { cn } from "@/lib/cn.ts";
import type { Playback } from "./playback.ts";
import { createSchedulerScene } from "./scene.ts";

export function SchedulerScene({
  playback,
  ariaLabel,
  busy,
  onSelect,
}: {
  playback: Playback;
  ariaLabel: string;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scene = createSchedulerScene(host.current!, playback.lesson.processes, playback.onMove);
    playback.attachScene(scene);
    return () => {
      playback.detachScene(scene);
      scene.destroy();
    };
  }, [playback]);

  const tokenOf = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.<SVGGElement>("[data-process]")?.dataset.process;

  return (
    // The scene is a group of focusable tokens (SVG role="button"); keys select them.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/prefer-tag-over-role -- clicks and keys come from the SVG tokens (role="button") inside
    <div
      ref={host}
      id="scene"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a group of SVG tokens
      role="group"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-busy={busy}
      className={cn(
        sceneBoxClass,
        "cpu-scene grid place-items-center px-3 pt-2 pb-1 outline-none stacked:overflow-hidden [@media(max-height:699px)]:overflow-hidden console:p-0 phone:p-0",
      )}
      onClick={(event) => {
        const id = tokenOf(event.target);
        if (id) onSelect(id);
      }}
      onKeyDown={(event) => {
        const id = tokenOf(event.target);
        if (!id || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(id);
      }}
    />
  );
}
