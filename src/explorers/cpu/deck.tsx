// The control palette: method, quantum, transport, seek and the guided switch.
// On the desktop console it is four tidy rows (kit grammar: segmented
// control, one transport button group, a slider, a switch):
//   method | quantum
//   [reset back play step next-event]
//   [speed] seek ───────────────────
//   guided switch + hint
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
} from "lucide-react";

import { Deck, Field } from "@/components/shell/console.tsx";
import { Button, ButtonGroup } from "@/components/ui/button.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Slider, SliderTicks } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import { METHODS } from "./lessons.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";

export function CpuDeck({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const hasQuantum = lesson.methods.includes("rr");
  const rr = snap.algorithm === "rr";
  const makespan = snap.result.stats.makespan;
  const clock = Math.max(0, snap.time);
  const canPause = snap.playing || (snap.transitioning && !snap.motionPaused);
  const done = snap.finished && !snap.transitioning;
  const playLabel = canPause
    ? LABELS.pause
    : done
      ? LABELS.replay
      : snap.time < 0
        ? LABELS.start
        : LABELS.resume;
  const PlayGlyph = canPause ? PauseIcon : done ? RotateCcwIcon : PlayIcon;
  const hint = snap.transitioning
    ? snap.motionPaused
      ? "이동을 멈췄습니다. 이어서 재생할 수 있습니다."
      : "작업이 이동 중입니다."
    : snap.finished
      ? "학습 완료 · 결과를 비교해 보세요."
      : snap.playing
        ? snap.guided
          ? "다음 핵심 장면에서 자동으로 멈춥니다."
          : "전체 과정을 연속으로 재생합니다."
        : snap.time < 0
          ? "핵심 장면마다 멈춥니다."
          : "장면을 살펴본 뒤 이어서 재생하세요.";

  return (
    <Deck
      aria-label="실험 조건과 재생"
      className="console:grid console:grid-cols-[minmax(0,1fr)_minmax(0,auto)] console:items-start console:gap-x-3 console:gap-y-3 console-short:gap-y-2.5"
    >
      <Field className={cn("phone:w-full", !hasQuantum && "console:col-span-2")}>
        <Label id="algorithm-label">CPU 배정 방식</Label>
        <SegmentedControl
          aria-labelledby="algorithm-label"
          value={snap.algorithm}
          onValueChange={(m) => playback.setAlgorithm(m)}
          className="phone:grid phone:w-full console:grid console:w-full"
        >
          {lesson.methods.map((m) => (
            <Segment key={m} value={m} data-algorithm={m} className="console:px-2.5">
              {METHODS[m].label}
            </Segment>
          ))}
        </SegmentedControl>
      </Field>

      {hasQuantum && (
        <Field className="w-[200px] console:w-[132px] phone:w-full">
          <Label className="justify-between" id="quantum-label">
            시간 할당량{" "}
            <output className={cn("tabular-nums", rr ? "text-label" : "text-label-2")}>
              {rr ? `${snap.quantum} ms` : "사용 안 함"}
            </output>
          </Label>
          <Slider
            min={1}
            max={5}
            step={1}
            value={snap.quantum}
            disabled={!rr}
            onValueChange={(value) => playback.setQuantum(value as number)}
            thumbLabel="시간 할당량"
          />
          <SliderTicks id="quantum-help" className="console-short:hidden">
            <span>1</span>
            <span>5</span>
          </SliderTicks>
        </Field>
      )}

      <ButtonGroup toolbar aria-label="재생" className="w-full console:col-span-2">
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          title="처음으로 (R)"
          aria-label="처음으로"
          onClick={() => playback.reset()}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="back"
          title="1 ms 이전 (←)"
          aria-label="1 ms 이전"
          disabled={snap.time < 0}
          onClick={() => playback.back()}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={playLabel}
          className="min-w-0 flex-1"
          onClick={() => playback.togglePlay()}
        >
          <PlayGlyph aria-hidden="true" />
          <span>{playLabel}</span>
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="step"
          title="1 ms 다음 (→)"
          aria-label="1 ms 다음"
          disabled={snap.finished}
          onClick={() => playback.step()}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="event"
          disabled={snap.finished}
          onClick={() => playback.nextEvent()}
        >
          다음 사건
        </Button>
      </ButtonGroup>

      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 phone:w-full console:col-span-2">
        <ButtonGroup>
          <Button
            variant="plain"
            size="icon"
            data-action="speed"
            aria-label={`재생 속도 ${snap.speed}배, 눌러서 변경`}
            className="tabular-nums"
            onClick={() => playback.cycleSpeed()}
          >
            {snap.speed}×
          </Button>
        </ButtonGroup>
        <Label>0</Label>
        <Slider
          id="seek"
          min={0}
          max={makespan}
          step={1}
          value={clock}
          thumbLabel="시뮬레이션 시각"
          thumbProps={{ "aria-valuetext": `${clock}밀리초, 전체 ${makespan}밀리초` }}
          onValueChange={(value) => playback.seek(value as number)}
        />
        <Label>{makespan} ms</Label>
      </div>

      <div className="flex min-h-6 flex-wrap items-center gap-x-3.5 gap-y-1.5 text-caption console:col-span-2">
        <Switch
          data-action="guided"
          checked={snap.guided}
          onCheckedChange={(on) => playback.setGuided(on)}
        >
          {LABELS.guided}
        </Switch>
        <span className="text-label-2">{hint}</span>
      </div>
    </Deck>
  );
}
