// The control palette, in two tiers:
//   primary   condition (policy or frame count) as a full-width segmented
//             control, then the transport — reset · back · play · next access
//   secondary a quieter group under a hairline: where you are (seek slider
//             with "3 / 10 접근"), then the guided switch, replay and speed
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

const SPEEDS = ["0.5", "1", "2"] as const;

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
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:gap-2.5 console-short:gap-2"
    >
      {/* Primary: what runs and the transport. */}
      <Field className="w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 phone:grid-cols-1">
        <Label id="mode-label" className="text-control font-semibold">
          {lesson.modeLabel}
        </Label>
        <SegmentedControl
          aria-labelledby="mode-label"
          value={snap.mode.id}
          onValueChange={(id) => void playback.setMode(id)}
          className="grid w-full"
        >
          {lesson.modes.map((m) => (
            <Segment key={m.id} value={m.id} data-mode={m.id} className="min-h-7">
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
          aria-label={`접근 순서 ${total}회`}
          className="grid auto-cols-[minmax(30px,1fr)] grid-flow-col rounded-full p-[3px] capsule phone:w-full phone:auto-cols-[minmax(0,1fr)]"
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
                "flex min-h-[42px] cursor-pointer flex-col items-center justify-center rounded-full border-0 bg-transparent px-1 py-[2px] leading-[1.15] phone:px-0",
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

      <ButtonGroup
        toolbar
        aria-label="재생"
        className="w-full [&>[data-slot=toolbar-button]]:min-h-8 phone:[&>[data-slot=toolbar-button]]:min-h-[42px]"
      >
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          aria-label="처음으로"
          title="처음으로 (R)"
          className="size-8"
          onClick={() => void playback.reset()}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="back"
          aria-label="이전 접근"
          title="이전 접근 (←)"
          className="size-8"
          disabled={index === 0}
          onClick={() => void playback.back()}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={moving ? LABELS.pause : "재생"}
          title="재생·정지 (Space)"
          className="min-w-0 flex-1 font-semibold"
          onClick={() => void playback.togglePlay()}
        >
          <PlayGlyph aria-hidden="true" />
          <span>{playLabel}</span>
        </Button>
        <Button
          variant="plain"
          data-action="next"
          title="다음 접근 (→)"
          disabled={busy || index === total}
          onClick={() => void playback.nextAccess()}
        >
          다음 접근
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      {/* Secondary: where we are, and how it plays. Quieter, under a hairline. */}
      <div
        data-slot="deck-secondary"
        className="grid w-full min-w-0 gap-2 border-t border-separator-soft pt-2.5 console-short:gap-1.5 console-short:pt-2"
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
          <Label>진행</Label>
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
          <Label className="min-w-[60px] justify-end tabular-nums">
            {index} / {total} 접근
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
          <div className="ms-auto flex items-center gap-1.5">
            <Button
              variant="plain"
              size="icon-sm"
              data-action="replay"
              aria-label="이번 접근 다시 보기"
              title="이번 접근 다시 보기"
              disabled={index === 0 || busy}
              onClick={() => void playback.replay()}
            >
              <RotateCcwIcon aria-hidden="true" />
            </Button>
            <SegmentedControl
              aria-label="재생 속도"
              data-action="speed"
              value={String(snap.speed) as (typeof SPEEDS)[number]}
              onValueChange={(value) => playback.setSpeed(Number(value))}
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
      </div>
    </Deck>
  );
}
