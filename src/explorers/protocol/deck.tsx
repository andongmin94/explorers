// The deck: every playback control. Transport keys, the speed selector, one
// event at a time, the guided switch (핵심 장면에서 멈추기) and a seek slider
// over the lesson's steps (0 = overview).
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
} from "lucide-react";

import { Deck, Field } from "@/components/shell/console.tsx";
import { Button } from "@/components/ui/button.tsx";
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
      <Field className="flex-[1_1_100%] min-w-0">
        <Label>재생</Label>
        <div className="flex items-center gap-2 phone:flex-wrap">
          <Button
            size="icon"
            data-action="reset"
            aria-label={translate("Reset")}
            title="처음으로 (R)"
            className="phone:min-h-11"
            onClick={() => controller.resetLesson()}
          >
            <SkipBackIcon aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            data-action="prev"
            aria-label={translate("Previous step")}
            title={translate("Previous step (←)")}
            disabled={!started}
            className="phone:min-h-11"
            onClick={controller.previous}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="primary"
            data-action="toggle"
            data-label={label}
            title={translate("Play / pause (Space)")}
            className="min-w-[132px] flex-auto phone:min-h-11 phone:min-w-0 phone:flex-1"
            onClick={controller.toggle}
          >
            <Glyph aria-hidden="true" />
            <span>{label}</span>
          </Button>
          <Button
            size="icon"
            data-action="next"
            aria-label="다음 단계"
            title="다음 단계 (→)"
            disabled={nextDisabled}
            className="phone:min-h-11"
            onClick={controller.next}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </Field>
      <Field>
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
              className="px-2.5 tabular-nums phone:min-h-[42px]"
            >
              {speed}×
            </Segment>
          ))}
        </SegmentedControl>
      </Field>
      <Field>
        <Label>한 사건씩</Label>
        <Button
          data-action="step"
          title="사건 하나만 진행"
          disabled={done}
          onClick={controller.stepEvent}
        >
          다음 사건
        </Button>
      </Field>
      <div className="flex min-h-[34px] items-center self-center">
        <Switch
          data-action="guided"
          title="예측이 있는 패킷 앞과 끝에서 멈춥니다"
          checked={snap.guided}
          onCheckedChange={(on) => controller.setGuided(on)}
        >
          {LABELS.guided}
        </Switch>
      </div>
      {/* The slider handles its own arrows; they must not also move the lesson. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only stops key propagation from the slider */}
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a labelled group of the seek slider and its ends
        role="group"
        aria-label="단계 이동"
        className="grid min-w-0 flex-[1_1_100%] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
      >
        <Label>{translate("OVERVIEW")}</Label>
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
        <Label>{max}단계</Label>
      </div>
    </Deck>
  );
}
