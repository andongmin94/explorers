// The stage scene: React owns the host element, the imperative scene
// (scene.ts) owns everything inside it. Mount once and hand the scene to the
// playback controller, which drives it.
import { useLayoutEffect, useRef } from "react";

import { sceneBoxClass } from "@/components/shell/console.tsx";
import { cn } from "@/lib/cn.ts";
import type { Playback } from "./playback.ts";
import { createMemoryScene } from "./scene.ts";

export function MemoryScene({
  playback,
  busy,
  masked,
}: {
  playback: Playback;
  busy: boolean;
  /** An outcome prediction is open: what is in RAM would answer it. */
  masked: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scene = createMemoryScene(host.current!, {
      frameCount: playback.frameCount,
      pages: playback.lesson.pages,
      onPhase: playback.onPhase,
    });
    playback.attachScene(scene);
    return () => {
      playback.detachScene(scene);
      scene.destroy();
    };
  }, [playback]);

  return (
    // The scene sets its own aria-label (the frames after the access on screen).
    <div
      ref={host}
      id="memory-scene"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a group of SVG devices
      role="group"
      tabIndex={-1}
      aria-busy={busy}
      data-masked={masked || undefined}
      className={cn(
        sceneBoxClass,
        "mem-scene min-h-0 p-0 outline-none phone:px-1 phone:pt-1 phone:pb-0",
      )}
    />
  );
}
