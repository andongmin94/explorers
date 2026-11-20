// The control palette: the lesson's two methods, transport, seek and the
// guided switch. On the desktop console it is one tidy grid:
//   method ─────────────────
//   reset   back   play
//   replay  speed  next
//   0 ── seek ──────── N
//   guided switch
import {
  ChevronFirstIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";

import { Deck, Field } from "@/components/shell/console.tsx";
import { Button, ButtonGroup } from "@/components/ui/button.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";
import type { TxPage } from "./page.ts";
import type { Player, PlayerSnapshot } from "./player.ts";

export function TxDeck({
  page,
  player,
  snap,
}: {
  page: TxPage;
  player: Player;
  snap: PlayerSnapshot;
}) {
  const moving = snap.playing || (snap.busy && !snap.paused);
  const playLabel = moving
    ? LABELS.pause
    : snap.done === snap.last && !snap.busy
      ? LABELS.replay
      : snap.index === 0
        ? LABELS.start
        : LABELS.resume;

  return (
    <Deck
      aria-label="재생 조작"
      className="console:grid console:grid-cols-[minmax(0,1fr)] console:items-center console:gap-y-3 console-short:gap-y-2.5"
    >
      <Field className="phone:w-full">
        <Label id="mode-label">{page.modeField}</Label>
        <SegmentedControl
          aria-label={page.modeAria}
          value={snap.mode}
          onValueChange={(mode) => player.setMode(mode)}
          className="phone:grid phone:w-full console:grid console:w-full console:grid-cols-2"
        >
          {page.modes.map((m) => (
            <Segment
              key={m}
              value={m}
              {...{ [`data-${page.modeAttr}`]: m }}
              className="console:px-2"
            >
              {page.modeLabels[m]}
            </Segment>
          ))}
        </SegmentedControl>
      </Field>

      <ButtonGroup aria-label="재생" className="w-full">
        <Button
          variant="plain"
          size="icon"
          data-action="reset"
          aria-label="처음으로"
          title="처음으로 (R)"
          onClick={() => void player.jump(0)}
        >
          <ChevronFirstIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          size="icon"
          data-action="back"
          aria-label="이전 사건"
          title="이전 사건 (←)"
          disabled={snap.index === 0}
          onClick={() => void player.jump(snap.index - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="plain"
          data-action="play"
          aria-label={moving ? "일시정지" : "재생"}
          className="min-w-0 flex-1"
          onClick={() => player.play()}
        >
          {moving ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          <span>{playLabel}</span>
        </Button>
        <Button
          variant="plain"
          data-action="next"
          disabled={snap.index === snap.last || snap.busy}
          onClick={() => void player.next()}
        >
          다음 사건
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 phone:w-full">
        <ButtonGroup>
          <Button
            variant="plain"
            size="icon"
            data-action="replay"
            aria-label="이번 사건 다시 보기"
            title="이번 사건 다시 보기"
            disabled={snap.index === 0 || snap.busy}
            onClick={() => void player.replay()}
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          <Button
            variant="plain"
            size="icon"
            data-action="speed"
            aria-label={`재생 속도 ${snap.speed}배, 눌러서 변경`}
            className="tabular-nums"
            onClick={() => player.cycleSpeed()}
          >
            {snap.speed}×
          </Button>
        </ButtonGroup>
        <Label>0</Label>
        <Slider
          id="seek"
          min={0}
          max={snap.last}
          step={1}
          value={snap.index}
          thumbLabel="처리한 사건 수"
          thumbProps={{
            "aria-valuetext": `${snap.index} / ${snap.last}번째 사건${snap.busy ? " 처리 중" : " 처리 완료"}`,
          }}
          onValueChange={(value) => void player.jump(value as number)}
        />
        <Label>{snap.last}</Label>
      </div>

      <div className="flex min-h-6 items-center">
        <Switch
          data-action="guided"
          checked={snap.guided}
          onCheckedChange={(on) => player.setGuided(on)}
        >
          {LABELS.guided}
        </Switch>
      </div>
    </Deck>
  );
}
