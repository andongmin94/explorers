// The control palette, in two tiers:
//   primary   the method (segmented, full width) with the RR quantum beside it,
//             then the transport — reset · back · play · 1 ms · next event
//   secondary a quieter group under a hairline: where you are (seek slider
//             with "3 / 20 ms"), then the guided switch and the speed
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";

import { Deck, Field } from "@/components/shell/console.tsx";
import { Button, ButtonGroup } from "@/components/ui/button.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import { METHODS } from "./lessons.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";

const SPEEDS = ["0.5", "1", "2"] as const;

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

  return (
    <Deck
      aria-label="실험 조건과 재생"
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:gap-2.5 console-short:gap-2"
    >
      {/* Primary: the condition and the transport. */}
      <div
        className={cn(
          "grid w-full min-w-0 items-end gap-x-3 gap-y-2.5",
          hasQuantum && "grid-cols-[minmax(0,1fr)_132px] phone:grid-cols-1",
        )}
      >
        <Field>
          <Label id="algorithm-label">CPU 배정 방식</Label>
          <SegmentedControl
            aria-labelledby="algorithm-label"
            value={snap.algorithm}
            onValueChange={(m) => playback.setAlgorithm(m)}
            className="grid w-full"
          >
            {lesson.methods.map((m) => (
              <Segment key={m} value={m} data-algorithm={m} className="min-h-7 px-2.5">
                {METHODS[m].label}
              </Segment>
            ))}
          </SegmentedControl>
        </Field>

        {hasQuantum && (
          <Field>
            <Label className="justify-between" id="quantum-label">
              시간 할당량{" "}
              <output className={cn("tabular-nums", rr ? "text-label" : "text-label-2")}>
                {rr ? `${snap.quantum} ms` : "RR에서만"}
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
              thumbProps={{ "aria-valuetext": `${snap.quantum}밀리초` }}
              className="my-0.5"
            />
          </Field>
        )}
      </div>

      <ButtonGroup
        toolbar
        aria-label="재생"
        className="w-full [&>[data-slot=toolbar-button]]:min-h-8 phone:[&>[data-slot=toolbar-button]]:min-h-[42px]"
      >
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          title="처음으로 (R)"
          aria-label="처음으로"
          className="size-8"
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
          className="size-8"
          disabled={snap.time < 0}
          onClick={() => playback.back()}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={playLabel}
          title="재생·정지 (Space)"
          className="min-w-0 flex-1 font-semibold"
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
          className="size-8"
          disabled={snap.finished}
          onClick={() => playback.step()}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="event"
          title="다음 사건까지 재생"
          disabled={snap.finished}
          onClick={() => playback.nextEvent()}
        >
          다음 사건
          <SkipForwardIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      {/* Secondary: where we are, and how it plays. Quieter, under a hairline. */}
      <div
        data-slot="deck-secondary"
        className="grid w-full min-w-0 gap-2 border-t border-separator-soft pt-2.5 console-short:gap-1.5 console-short:pt-2"
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
          <Label>시각</Label>
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
          <Label className="min-w-[64px] justify-end tabular-nums">
            {clock} / {makespan} ms
          </Label>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Switch
            data-action="guided"
            checked={snap.guided}
            onCheckedChange={(on) => playback.setGuided(on)}
            className="text-caption"
          >
            {LABELS.guided}
          </Switch>
          <SegmentedControl
            aria-label="재생 속도"
            data-action="speed"
            value={String(snap.speed) as (typeof SPEEDS)[number]}
            onValueChange={(value) => playback.setSpeed(Number(value))}
            className="ms-auto"
          >
            {SPEEDS.map((speed) => (
              <Segment
                key={speed}
                value={speed}
                aria-label={`${speed}배속`}
                className="min-h-[22px] px-2 text-caption tabular-nums"
              >
                {speed}×
              </Segment>
            ))}
          </SegmentedControl>
        </div>
      </div>
    </Deck>
  );
}
