// The control palette, in two tiers:
//   primary   — the transport [처음] [이전] [▶ 학습 시작 ────] [다음 사건 ›]
//   secondary — quieter, below a hairline: the seek bar with its own
//               "진행 03 / 06" line, [다시 보기 · 속도 1×], the guided switch, the hint.
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
} from "lucide-react";

import { Deck } from "@/components/shell/console.tsx";
import { Button, ButtonGroup } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";
import { pad } from "./format.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";

export function GitDeck({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const { index, busy, paused, playing, completed } = snap;
  const last = snap.run.steps.length - 1;
  const moving = playing || (busy && !paused);
  const gated = index === playback.gate && !busy;
  let label: string = index ? LABELS.resume : LABELS.start;
  if (moving) label = LABELS.pause;
  else if (gated) label = "해결안 선택";
  else if (completed === last) label = LABELS.replay;
  const hint = gated
    ? "‘해결안 선택’을 눌러 파일에 남길 제목을 고르세요."
    : busy
      ? paused
        ? "이동과 상태를 함께 멈췄습니다."
        : "스냅샷과 브랜치 표지의 이동을 보세요."
      : index === last
        ? lesson.gate
          ? "병합 커밋 C3의 두 부모를 확인하세요."
          : `‘${lesson.compareLabel}’에서 다른 방식과 견주어 보세요.`
        : "다음 사건을 실행하거나 기록에서 바로 이동하세요.";

  return (
    <Deck aria-label="재생 조작" className="console:gap-y-3">
      <ButtonGroup toolbar aria-label="재생" className="w-full basis-full">
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
          aria-label="이전 사건"
          disabled={index === 0}
          onClick={() => playback.jump(index - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={label}
          className="min-w-0 flex-1 font-semibold"
          onClick={() => playback.togglePlay()}
        >
          {moving ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          <span>{label}</span>
        </Button>
        <Button
          variant="plain"
          data-action="next"
          disabled={index === last || busy || gated}
          onClick={() => playback.next()}
        >
          다음 사건
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <div
        data-deck="secondary"
        className="grid w-full min-w-0 basis-full gap-2 border-t border-separator-soft pt-2.5 console-short:gap-1.5 console-short:pt-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Label id="seek-label">진행</Label>
          <span
            id="seek-value"
            aria-hidden="true"
            className="ms-auto text-caption font-medium text-vlabel-2 tabular-nums"
          >
            {pad(index)} / <span id="seek-end">{pad(last)}</span> 사건
          </span>
        </div>
        <Slider
          id="seek"
          min={0}
          max={last}
          step={1}
          value={index}
          thumbLabel="현재 사건"
          thumbProps={{ "aria-valuetext": `${index} / ${last} 사건${busy ? " 처리 중" : ""}` }}
          onValueChange={(value) => playback.jump(value as number)}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <ButtonGroup aria-label="보기 설정">
            <Button
              variant="plain"
              size="sm"
              data-action="replay"
              aria-label="이번 사건 다시 보기"
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
              aria-label={`재생 속도 ${snap.speed}배`}
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
        <p
          id="playback-hint"
          className="m-0 text-caption leading-[1.45] text-vlabel-2 keep-all text-pretty"
        >
          {hint}
        </p>
      </div>
    </Deck>
  );
}
