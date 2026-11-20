// 프로토콜 탐색기: one page, fourteen protocols picked from the left rail
// (?lesson=… opens one directly). The stage shows the network or the
// sequence view (V), the deck holds playback, the side plate explains the
// lesson, the records plate holds the packet table and the inspector.
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Led, Readout } from "@/components/ui/content.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { ProtocolController, useController, type Snapshot } from "./controller.ts";
import { ProtocolDeck } from "./deck.tsx";
import { translate } from "./i18n.ts";
import { ProtocolPrediction } from "./prediction.tsx";
import { progressVersion, subscribeProgress } from "./progress.ts";
import { ProtocolRail } from "./rail.tsx";
import { ProtocolRecords } from "./records.tsx";
import { ProtocolScenes } from "./scenes.tsx";
import { ProtocolSide, type SideTab } from "./side.tsx";
import { ProtocolToolbar } from "./toolbar.tsx";
import type { ViewMode } from "./types.ts";

const VIEWS: [ViewMode, string][] = [
  ["network", "NETWORK"],
  ["sequence", "SEQUENCE"],
];

/** One short status line under the stage: playback state and packets sent. */
function stageStatus({ playback, lesson, pending }: Snapshot) {
  if (!playback)
    return `${translate("OVERVIEW · {n} STEPS", { n: lesson.steps.length })} · 학습 시작을 누르면 시작합니다`;
  const total = playback.packets.length;
  const sent = playback.packets.filter((packet) => packet !== "future").length;
  const held = !playback.playing && pending;
  return !playback.started
    ? `${translate("OVERVIEW · {n} STEPS", { n: lesson.steps.length })} · 학습 시작을 누르면 시작합니다`
    : playback.done
      ? `${translate("END OF SCENARIO")} · 패킷 ${total}개 모두 전송 · 정리`
      : held
        ? `핵심 장면 · 다음 패킷을 먼저 맞혀 보세요 · 패킷 ${sent}/${total}`
        : `${playback.playing ? "재생 중" : "일시정지"} · 패킷 ${sent}/${total}`;
}

export function App() {
  const [controller] = useState(() => new ProtocolController());
  const snap = useController(controller);
  const version = useSyncExternalStore(subscribeProgress, progressVersion, progressVersion);
  const [sideTab, setSideTab] = useState<SideTab>("lesson");
  const { lesson, playback } = snap;
  const sheetOpen = snap.quiz !== null;

  useEffect(() => () => controller.dispose(), [controller]);

  // Inspecting a packet makes the records taller. <Console> recomputes
  // --records-extra only when the deck or the grid resizes, so do it here
  // when the wanted height changes (same formula as console.tsx).
  const inspecting = snap.inspected !== null;
  useLayoutEffect(() => {
    const grid = document.querySelector<HTMLElement>("main.console-grid");
    const records = grid?.querySelector<HTMLElement>(':scope > [data-plate="records"]');
    const deck = grid?.querySelector<HTMLElement>(':scope > [data-plate="deck"]');
    if (!grid || !records || !deck) return;
    const want = parseFloat(getComputedStyle(records).scrollMarginTop) || 0;
    const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
    const extra = Math.max(0, want - deck.getBoundingClientRect().height - gap);
    grid.style.setProperty("--records-extra", `${Math.round(extra)}px`);
  }, [inspecting]);

  // Keyboard: Space play/pause, ←/→ steps (packets while inspecting), R start, V view, Esc closes the inspector.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheetOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as Element | null;
      if (
        target?.closest?.(
          "input,select,textarea,button,a,summary,[role='button'],[contenteditable='true']",
        )
      )
        return;
      const actions: Record<string, () => void> = {
        " ": controller.toggle,
        ArrowRight: controller.forward,
        ArrowLeft: controller.backward,
        Escape: controller.closeInspector,
        r: () => controller.resetLesson(),
        R: () => controller.resetLesson(),
        v: controller.toggleView,
        V: controller.toggleView,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) action();
    };
    const onVisibility = () => document.hidden && controller.pause();
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [controller, sheetOpen]);

  const steps = lesson.steps.length;
  const lcd = playback?.started
    ? `${Math.min(playback.activeStep + 1, steps)}/${steps}`
    : `0/${steps}`;

  return (
    <ExplorerPage>
      <ProtocolToolbar lesson={lesson} progressVersion={version} />
      <Console
        recordsHeight={
          snap.inspected !== null ? "clamp(320px, 48vh, 540px)" : "clamp(200px, 27vh, 320px)"
        }
      >
        <ProtocolRail
          current={lesson.id}
          onSelect={(id) => controller.selectLesson(id)}
          progressVersion={version}
        />
        <Stage
          label="통신 장면"
          className="[&>[data-slot]]:flex-wrap"
          head={
            <>
              <SegmentedControl
                aria-label={translate("View")}
                title={translate("Switch view (V)")}
                value={snap.view}
                onValueChange={(view) => controller.setView(view)}
                className="ms-auto phone:ms-0"
              >
                {VIEWS.map(([view, label]) => (
                  <Segment key={view} value={view} data-view={view}>
                    {translate(label)}
                  </Segment>
                ))}
              </SegmentedControl>
              <Readout glass aria-hidden="true" className="phone:ms-auto">
                <span id="stage-step">{lcd}</span>
                <small>단계</small>
              </Readout>
            </>
          }
          foot={
            <>
              <Led on={Boolean(playback?.playing)} />
              <span id="status-text" className="min-w-0 truncate">
                {stageStatus(snap)}
              </span>
            </>
          }
        >
          <ProtocolScenes controller={controller} view={snap.view} />
        </Stage>
        <ProtocolDeck controller={controller} snap={snap} />
        <ProtocolSide
          controller={controller}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          progressVersion={version}
        />
        <ProtocolRecords controller={controller} snap={snap} />
      </Console>
      <Footer
        shortcuts={
          <>
            조작: <Kbd>Space</Kbd> 재생·일시정지 <Kbd>←</Kbd>
            <Kbd>→</Kbd> 이전·다음 단계 (검사 중에는 패킷) <Kbd>R</Kbd> 처음으로 <Kbd>V</Kbd> 보기
            전환 <Kbd>Esc</Kbd> 닫기
          </>
        }
        sources={<>교육용 패킷 시나리오 · 실제 통신을 캡처하지 않습니다</>}
      />
      <ProtocolPrediction controller={controller} session={snap.quiz} />
    </ExplorerPage>
  );
}
