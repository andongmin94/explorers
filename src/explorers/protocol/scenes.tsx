// The stage scenes: React owns the host elements, the imperative modules own
// everything inside them (simulation/network-*.ts draws and animates the
// isometric network, simulation/sequence.ts the sequence diagram). Both read
// the same playback; the controller updates them.
import { useLayoutEffect, useRef } from "react";

import { sceneBoxClass } from "@/components/shell/console.tsx";
import { cn } from "@/lib/cn.ts";
import type { ProtocolController } from "./controller.ts";
import { createNetworkAnimation } from "./simulation/network-animation.ts";
import { renderNetworkDiagram } from "./simulation/network-drawing.ts";
import {
  bindSequenceScrolling,
  renderSequencePanel,
  type SequencePanel,
} from "./simulation/sequence.ts";
import type { ViewMode } from "./types.ts";

function NetworkScene({ controller }: { controller: ProtocolController }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current!;
    element.innerHTML = renderNetworkDiagram();
    const scene = createNetworkAnimation(element.querySelector("svg.network"));
    controller.attachNetwork(scene);
    return () => {
      controller.detachNetwork(scene);
      scene.destroy();
      element.replaceChildren();
    };
  }, [controller]);
  return <div ref={host} className="pe-network-host absolute inset-0" />;
}

function SequenceScene({ controller }: { controller: ProtocolController }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current!;
    element.innerHTML = renderSequencePanel();
    const panel = element.firstElementChild as SequencePanel;
    const unbind = bindSequenceScrolling(panel);
    controller.attachSequence(panel);
    return () => {
      controller.detachSequence(panel);
      unbind();
      element.replaceChildren();
    };
  }, [controller]);
  return (
    // A drawn arrow opens its packet in the inspector (the arrows are SVG, not controls).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the packet table rows are the keyboard path to the same packets
    <div
      ref={host}
      className="pe-sequence-host absolute inset-0"
      onClick={(event) => {
        const arrow = (event.target as Element).closest<SVGGElement>(".seq-arrow.is-shown");
        if (arrow) controller.inspect(Number(arrow.dataset.packet));
      }}
    />
  );
}

/** The scene box: the network, or the sequence diagram over it (V switches). */
export function ProtocolScenes({
  controller,
  view,
}: {
  controller: ProtocolController;
  view: ViewMode;
}) {
  return (
    <div
      className={cn(
        sceneBoxClass,
        "pe-scene simulation overflow-hidden",
        // Stacked: a fixed height (phones: a square); the console: the remaining height.
        "h-[clamp(380px,calc(100dvh-400px),640px)] min-h-0 phone:aspect-square phone:h-auto phone:max-h-[72vh]",
        "console:h-auto console:overflow-visible",
        view === "sequence" && "is-sequence",
      )}
    >
      <NetworkScene controller={controller} />
      <SequenceScene controller={controller} />
    </div>
  );
}
