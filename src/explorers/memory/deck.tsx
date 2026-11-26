// The control palette: condition (policy or frame count), the access keypad,
// the transport, the seek slider and the guided switch. On the desktop
// console it is one column in the side column:
//   condition label ··········· segments
//   reset  back  play ────────
//   replay speed next access ─
//   0 ── seek ────────────── N
//   guided switch
// The access keypad repeats the frame record's header row, so the console
// leaves it out (the accesses stay clickable there, on the slider and with
// the arrow keys); stacked and on phones it is a row of keys.
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
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import { pageColor } from "./scene.ts";

export function MemoryDeck({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const total = playback.total;
  const { index, busy, committed } = snap;
  const moving = snap.playing || (busy && !snap.motionPaused);
  const playLabel = moving
    ? LABELS.pause
    : index === total && !busy
      ? LABELS.replay
      : index === 0
        ? LABELS.start
        : LABELS.resume;
  const PlayGlyph = moving ? PauseIcon : PlayIcon;

  return (
    <Deck
      aria-label="조작"
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:gap-3 console-short:gap-2.5"
    >
      <Field className="console:flex console:w-full console:items-center console:justify-between console:gap-3">
        <Label id="mode-label">{lesson.modeLabel}</Label>
        <SegmentedControl
          aria-labelledby="mode-label"
          value={snap.mode.id}
          onValueChange={(id) => void playback.setMode(id)}
        >
          {lesson.modes.map((m) => (
            <Segment key={m.id} value={m.id} data-mode={m.id} className="console:px-[22px]">
              {m.label}
            </Segment>
          ))}
        </SegmentedControl>
      </Field>

      <Field className="phone:w-full console:hidden">
        <Label>
          접근 순서 <Muted>· 눌러서 이동</Muted>
        </Label>
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a row of keys, like a segmented control
          role="group"
          aria-label={`고정된 접근 순서 ${total}회`}
          className="grid auto-cols-[minmax(34px,1fr)] grid-flow-col rounded-full p-[3px] capsule phone:w-full phone:auto-cols-[minmax(0,1fr)]"
        >
          {lesson.references.map((page, i) => (
            <button
              key={i}
              type="button"
              data-seek={i + 1}
              aria-pressed={i + 1 === index}
              aria-label={`${i + 1}번째, 페이지 ${page} 접근 후로 이동`}
              style={{ "--pg": pageColor(page) } as React.CSSProperties}
              onClick={() => void playback.seek(i + 1)}
              className={cn(
                "flex min-h-[42px] cursor-pointer flex-col items-center justify-center rounded-full border-0 bg-transparent px-1.5 py-[2px] leading-[1.15] phone:px-0",
                "hover:not-aria-pressed:bg-lg-hover aria-pressed:bg-sel focus-visible:ring-focus",
                "relative not-first:before:absolute not-first:before:top-1/2 not-first:before:left-0 not-first:before:-mt-[7px] not-first:before:h-3.5 not-first:before:w-px not-first:before:bg-capsule-divider not-first:before:content-[''] aria-pressed:before:opacity-0 [[aria-pressed=true]+&]:before:opacity-0",
              )}
            >
              <small className="font-sans text-caption font-medium text-label-2 tabular-nums">
                {i + 1}
              </small>
              <b
                className={cn(
                  "font-sans text-control font-bold",
                  i < committed
                    ? "text-[var(--pg)]"
                    : "text-[color-mix(in_srgb,var(--pg)_50%,var(--label-2))]",
                )}
              >
                {page}
              </b>
            </button>
          ))}
        </div>
      </Field>

      <ButtonGroup toolbar aria-label="재생" className="w-full">
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          aria-label="처음으로"
          onClick={() => void playback.reset()}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="back"
          aria-label="이전 접근"
          disabled={index === 0}
          onClick={() => void playback.back()}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={moving ? LABELS.pause : "재생"}
          className="min-w-0 flex-1"
          onClick={() => void playback.togglePlay()}
        >
          <PlayGlyph aria-hidden="true" />
          <span>{playLabel}</span>
        </Button>
        <Button
          variant="plain"
          data-action="next"
          disabled={busy || index === total}
          onClick={() => void playback.nextAccess()}
        >
          다음 접근
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 phone:w-full">
        <ButtonGroup>
          <Button
            variant="plain"
            size="icon"
            data-action="replay"
            aria-label="이번 접근 다시 보기"
            title="이번 접근 다시 보기"
            disabled={index === 0 || busy}
            onClick={() => void playback.replay()}
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          <Button
            variant="plain"
            size="icon"
            data-action="speed"
            aria-label={`재생 속도 ${snap.speed}배`}
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
          max={total}
          step={1}
          value={index}
          thumbLabel="처리한 페이지 접근 수"
          thumbProps={{ "aria-valuetext": `${index}번의 페이지 접근, 전체 ${total}번` }}
          onValueChange={(value) => void playback.seek(value as number)}
        />
        <Label>{total}</Label>
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
