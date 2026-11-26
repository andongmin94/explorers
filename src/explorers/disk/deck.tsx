// The control palette: the two rules, the transport, the seek bar and the
// guided switch. On the desktop console it is one column:
//   rule A | rule B
//   reset  back  play ────────
//   replay speed next request
//   0 ── seek ── 8
//   guided switch
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
import { N, type Playback, type PlaybackSnapshot } from "./playback.ts";
import type { Algorithm } from "./types.ts";

export function DiskDeck({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const { index, committed, busy } = snap;
  const moving = snap.playing || (busy && !snap.paused);
  const playLabel = moving
    ? "일시정지"
    : committed === N && !busy
      ? "다시 재생"
      : index
        ? "이어서 재생"
        : "학습 시작";

  return (
    <Deck
      aria-label="실험 조작"
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:gap-3 console-short:gap-2.5"
    >
      <Field className="phone:w-full console:w-full">
        <Label id="algorithm-label">다음 요청을 고르는 기준</Label>
        <SegmentedControl<Algorithm>
          aria-label="스케줄링 알고리즘"
          value={snap.algorithm}
          onValueChange={(alg) => playback.setAlgorithm(alg)}
          className="phone:grid phone:w-full console:grid console:w-full console:grid-cols-2"
        >
          {lesson.algorithms.map((alg) => (
            <Segment
              key={alg}
              value={alg}
              data-algorithm={alg}
              className="group/seg console:px-2.5"
            >
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
          className="min-w-0 flex-1"
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

      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 phone:w-full">
        <ButtonGroup>
          <Button
            variant="plain"
            size="icon"
            data-action="replay"
            aria-label={`${LABELS.now} 요청 다시 보기`}
            disabled={index === 0 || busy}
            onClick={() => void playback.replay()}
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          <Button
            variant="plain"
            size="icon"
            data-action="speed"
            aria-label={`재생 속도 ${snap.speed}배, 바꾸기`}
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
          max={N}
          step={1}
          value={index}
          thumbLabel="처리한 요청 수"
          thumbProps={{ "aria-valuetext": `${index} / ${N} 요청${busy ? " 처리 중" : " 완료"}` }}
          onValueChange={(value) => playback.jump(value as number)}
        />
        <Label>{N}</Label>
      </div>

      <Switch
        data-action="guided"
        checked={snap.guided}
        onCheckedChange={(on) => playback.setGuided(on)}
      >
        {LABELS.guided}
      </Switch>
    </Deck>
  );
}
