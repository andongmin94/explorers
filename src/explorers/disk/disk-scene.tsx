// The stage scene: React owns the host element, the imperative scene
// (scene.ts) owns everything inside it. Mount once and hand the scene to the
// playback controller, which drives it and hears its stages and head back.
import { useLayoutEffect, useRef } from "react";

import { sceneBoxClass } from "@/components/shell/console.tsx";
import { cn } from "@/lib/cn.ts";
import type { Playback } from "./playback.ts";
import { createDiskScene } from "./scene.ts";

export function DiskScene({ playback, busy }: { playback: Playback; busy: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scene = createDiskScene(host.current!, {
      onPhase: playback.onPhase,
      onHead: playback.onHead,
      onTravel: playback.onTravel,
      input: playback.lesson.input,
    });
    playback.attachScene(scene);
    return () => {
      playback.detachScene(scene);
      scene.destroy();
    };
  }, [playback]);

  return (
    <div
      ref={host}
      id="disk-scene"
      tabIndex={-1}
      aria-busy={busy}
      className={cn(
        sceneBoxClass,
        "disk-scene px-3 pt-2 pb-1 outline-none stacked:overflow-hidden [@media(max-height:699px)]:overflow-hidden phone:p-1",
      )}
    />
  );
}
