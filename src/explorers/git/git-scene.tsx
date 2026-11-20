// The stage scene: React owns the host element, the imperative scene
// (scene.ts) owns everything inside it. Mount once and hand the scene to the
// playback controller.
import { useLayoutEffect, useRef } from "react";

import { sceneBoxClass } from "@/components/shell/console.tsx";
import { cn } from "@/lib/cn.ts";
import type { Focus } from "./lesson-model.ts";
import type { Playback } from "./playback.ts";
import { createGitScene } from "./scene.ts";

export function GitScene({
  playback,
  focus,
  busy,
}: {
  playback: Playback;
  /** The device the current step is about: its callout title takes the accent. */
  focus: Focus;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scene = createGitScene(host.current!, {
      layout: playback.lesson.layout,
      onPhase: playback.onPhase,
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
      id="git-scene"
      data-focus={focus}
      aria-busy={busy}
      className={cn(
        sceneBoxClass,
        "git-scene min-h-0 console:[grid-area:2/1] phone:overflow-hidden",
      )}
    />
  );
}
