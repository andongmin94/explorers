// The deck: every playback control. Primary: the transport (reset · previous
// step · play · next step). Secondary, under a hairline and quieter: the seek
// slider over the lesson's steps (0 = overview) with where it is, the guided
// switch (핵심 장면에서 멈추기), one event at a time and the speed.
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
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";
import { SPEEDS, type ProtocolController, type Snapshot } from "./controller.ts";
import { translate } from "./i18n.ts";

export function ProtocolDeck({
  controller,
  snap,
}: {
  controller: ProtocolController;
  snap: Snapshot;
}) {
  const { lesson } = snap;
  const playback = snap.playback;
  const started = Boolean(playback?.started);
  const done = Boolean(playback?.done);
  const playing = Boolean(playback?.playing);
  const label = playing
    ? LABELS.pause
    : done
      ? LABELS.replay
      : started
        ? LABELS.resume
        : LABELS.start;
  const Glyph = playing ? PauseIcon : done ? RotateCcwIcon : PlayIcon;
  const max = lesson.steps.length;
  const value = started ? (done ? max : playback!.activeStep + 1) : 0;
  const nextDisabled = started && (done || playback!.activeStep >= lesson.steps.length - 1);

  return (
    <Deck aria-label="재생 조작" className="items-start console:gap-y-2.5">
      <ButtonGroup toolbar aria-label="재생" className="w-full flex-[1_1_100%]">
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          aria-label={translate("Reset")}
          title="처음으로 (R)"
          onClick={() => controller.resetLesson()}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="prev"
          aria-label={translate("Previous step")}
          title={translate("Previous step (←)")}
          disabled={!started}
          onClick={controller.previous}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="toggle"
          data-label={label}
          title={translate("Play / pause (Space)")}
          className="min-w-0 flex-1"
          onClick={controller.toggle}
        >
          <Glyph aria-hidden="true" />
          <span>{label}</span>
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="next"
          aria-label="다음 단계"
          title="다음 단계 (→)"
          disabled={nextDisabled}
          onClick={controller.next}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>
      {/* Secondary: where in the lesson, how it plays. Quieter than the transport. */}
      <div
        data-deck="secondary"
        className="grid w-full min-w-0 flex-[1_1_100%] gap-2 border-t border-separator-soft pt-2.5 console-short:gap-1.5 console-short:pt-2 min-[760px]:max-[1099px]:flex min-[760px]:max-[1099px]:flex-wrap min-[760px]:max-[1099px]:items-center min-[760px]:max-[1099px]:gap-x-8"
      >
        {/* The slider handles its own arrows; they must not also move the lesson. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only stops key propagation from the slider */}
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a labelled group of the seek slider and its value
          role="group"
          aria-labelledby="seek-label"
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 min-[760px]:max-[1099px]:basis-full"
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        >
          <Label id="seek-label">단계 이동</Label>
          <Slider
            className="seek"
            min={0}
            max={max}
            step={1}
            value={value}
            thumbLabel="단계 이동"
            thumbProps={{
              "aria-valuetext":
                value === 0 ? translate("OVERVIEW") : `${Math.min(value, max)}단계 / ${max}`,
            }}
            onValueChange={(next) => controller.seek(next as number)}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 min-[760px]:max-[1099px]:gap-x-4">
          <Switch
            data-action="guided"
            title="예측이 있는 패킷 앞과 끝에서 멈춥니다"
            checked={snap.guided}
            onCheckedChange={(on) => controller.setGuided(on)}
          >
            {LABELS.guided}
          </Switch>
          <ButtonGroup aria-label="한 사건씩" className="flex-none">
            <Button
              variant="plain"
              size="sm"
              data-action="step"
              title="사건 하나만 진행"
              disabled={done}
              onClick={controller.stepEvent}
            >
              사건 하나씩
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </ButtonGroup>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 min-[760px]:max-[1099px]:justify-start">
          <Label id="speed-label">{translate("Playback speed")}</Label>
          <SegmentedControl
            aria-labelledby="speed-label"
            value={String(snap.speed)}
            onValueChange={(speed) => controller.setSpeed(Number(speed))}
          >
            {SPEEDS.map((speed) => (
              <Segment
                key={speed}
                value={String(speed)}
                data-speed={speed}
                className="min-h-[22px] px-2 text-caption tabular-nums phone:min-h-[42px]"
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
