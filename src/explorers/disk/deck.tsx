// The control palette, in two tiers:
//   primary   — which rule (segmented control) and the transport
//               [처음] [이전] [▶ 학습 시작 ────] [다음 요청 ›]
//   secondary — quieter, below a hairline: the seek bar with its own
//               "진행 3 / 8" line, then [다시 보기 · 속도 1×] and the guided switch.
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
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label, Muted } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";
import { fix } from "./format.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import type { Algorithm } from "./types.ts";

export function DiskDeck({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const { index, committed, busy, n: N } = snap;
  const moving = snap.playing || (busy && !snap.paused);
  const playLabel = moving
    ? LABELS.pause
    : committed === N && !busy
      ? LABELS.replay
      : index
        ? LABELS.resume
        : LABELS.start;

  return (
    <Deck
      aria-label="실험 조작"
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:gap-3 console-short:gap-2.5"
    >
      <Field className="w-full">
        <Label id="algorithm-label">다음 요청을 고르는 기준</Label>
        <SegmentedControl<Algorithm>
          aria-labelledby="algorithm-label"
          value={snap.algorithm}
          onValueChange={(alg) => playback.setAlgorithm(alg)}
          className="grid w-full grid-cols-2"
        >
          {lesson.algorithms.map((alg) => (
            <Segment key={alg} value={alg} data-algorithm={alg} className="group/seg px-2.5">
              {fix(lesson.names[alg]!)}{" "}
              <Muted className="font-medium">{lesson.ruleShort[alg]}</Muted>
            </Segment>
          ))}
        </SegmentedControl>
      </Field>

      <ButtonGroup toolbar aria-label="재생" className="w-full">
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          aria-label="처음으로"
          onClick={() => playback.reset()}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="back"
          aria-label="이전 요청"
          disabled={index === 0}
          onClick={() => playback.back()}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={moving ? "일시정지" : "재생"}
          className="min-w-0 flex-1 font-semibold"
          onClick={() => playback.togglePlay()}
        >
          {moving ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          <span>{playLabel}</span>
        </Button>
        <Button
          variant="plain"
          data-action="next"
          disabled={index === N || busy}
          onClick={() => playback.next()}
        >
          다음 요청 <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <div
        data-deck="secondary"
        className="grid w-full min-w-0 gap-2 border-t border-separator-soft pt-2.5 console-short:gap-1.5 console-short:pt-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Label id="seek-label">진행</Label>
          <span
            id="seek-value"
            aria-hidden="true"
            className="ms-auto text-caption font-medium text-vlabel-2 tabular-nums"
          >
            {index} / {N} 요청
          </span>
        </div>
        <Slider
          id="seek"
          min={0}
          max={N}
          step={1}
          value={index}
          thumbLabel="처리한 요청 수"
          thumbProps={{ "aria-valuetext": `${index} / ${N} 요청${busy ? " 처리 중" : " 완료"}` }}
          onValueChange={(value) => playback.jump(value as number)}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <ButtonGroup aria-label="보기 설정">
            <Button
              variant="plain"
              size="sm"
              data-action="replay"
              aria-label={`${LABELS.now} 요청 다시 보기`}
              disabled={index === 0 || busy}
              onClick={() => void playback.replay()}
            >
              <RotateCcwIcon aria-hidden="true" />
              <span className="phone:sr-only">다시 보기</span>
            </Button>
            <Button
              variant="plain"
              size="sm"
              data-action="speed"
              aria-label={`재생 속도 ${snap.speed}배, 바꾸기`}
              className="tabular-nums"
              onClick={() => playback.cycleSpeed()}
            >
              <span className="text-vlabel-2">속도</span> {snap.speed}×
            </Button>
          </ButtonGroup>
          <Switch
            data-action="guided"
            className="ms-auto text-caption"
            checked={snap.guided}
            onCheckedChange={(on) => playback.setGuided(on)}
          >
            {LABELS.guided}
          </Switch>
        </div>
      </div>
    </Deck>
  );
}
