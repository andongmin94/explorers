// 해설: the blocks of the side panel's first tab for the frame on screen —
// the start screen (목표), a 핵심 장면's explanation with 이번 사건 and the
// 핵심 note, or a move in flight; at the end the 정리 blocks follow.
import { Button } from "@/components/ui/button.tsx";
import { Led, List, Note } from "@/components/ui/content.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { MisconceptionNote, misconceptionsAt } from "@/components/learning/misconception.tsx";
import type { PagedItem } from "@/components/learning/pager.tsx";
import { LABELS, type Misconception } from "@/lib/lesson-kit.ts";
import { colorOf, keepUnits, moveText } from "./format.ts";
import { josa } from "./josa.ts";
import { eventLabel } from "./lesson.ts";
import type { Lesson } from "./lessons.ts";
import type { PlaybackSnapshot } from "./playback.ts";

/** The heading block every state starts with (focus target after a jump). */
function Explanation({
  eyebrow,
  title,
  body,
}: {
  eyebrow: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      id="explanation"
      tabIndex={-1}
      aria-live="polite"
      aria-atomic="true"
      className="grid gap-1.5 outline-none"
    >
      <Label>{eyebrow}</Label>
      <Title>{keepUnits(title)}</Title>
      <Text className="mt-1">{keepUnits(body)}</Text>
    </div>
  );
}

/** A stable key for what the 해설 shows: when it changes the pages start over. */
export function explanationKey(snap: PlaybackSnapshot) {
  return `${snap.algorithm}:${snap.quantum}:${snap.time}:${snap.move ? `${snap.move.type}-${snap.move.id}` : ""}`;
}

export function explanationItems({
  lesson,
  lessonNumber,
  snap,
  onReplay,
  misconceptions = [],
}: {
  lesson: Lesson;
  lessonNumber: string;
  snap: PlaybackSnapshot;
  onReplay: () => void;
  /** 오개념 바로잡기 of this run: each shows beside the 핵심 note at its 핵심 장면. */
  misconceptions?: readonly Misconception[];
}): PagedItem[] {
  const { result, frame, move, time, algorithm } = snap;
  const content = lesson.content;
  const hasIo = lesson.processes.some((p) => p.io.length);

  if (time < 0 && !move) {
    // 목표: the question and the setup; nothing that has not happened yet.
    const goal = content.intro(result);
    return [
      {
        key: "intro",
        node: (
          <Explanation
            eyebrow={
              <>
                <Index>{lessonNumber}</Index> {goal.eyebrow}
              </>
            }
            title={goal.title}
            body={goal.body}
          />
        ),
      },
      {
        key: "goal",
        text: keepUnits(goal.goal),
        className: "m-0 text-body text-label text-pretty keep-all console-short:leading-normal",
      },
      {
        key: "terms",
        node: (
          <List as="dl">
            {goal.terms.map(([term, meaning]) => (
              <div key={term} className="items-baseline! gap-3! px-0! py-[7px]!">
                <dt className="w-[84px] flex-none font-[650]">{term}</dt>
                <dd className="m-0 text-label-2">{meaning}</dd>
              </div>
            ))}
          </List>
        ),
      },
    ];
  }

  const description = { ...content.chapter(frame, result) };
  let { key, notes } = content.stepNotes(frame, result);
  if (move) {
    const order = frame.events.length + 1;
    description.eyebrow = `${time} ms · 이번 사건 ${order}/${result.frames[time].events.length}`;
    description.title = eventLabel(move, algorithm);
    description.body = moveText(move.type, algorithm, hasIo);
    key = `이동 직전 준비 큐 · ${frame.ready.join(" → ") || "비어 있음"}`;
    notes = [];
  }
  const visibleEvents = move ? [...frame.events, move] : frame.events;
  const canReplay = !move && time >= 0 && result.frames[time].events.length > 0;
  // At a 핵심 장면 (not mid-move; 정리 lists them all once the run is over).
  const scene =
    move || snap.finished ? 0 : content.milestones(result).findIndex((m) => m.time === time) + 1;
  const corrections: PagedItem[] = misconceptionsAt(misconceptions, scene).map((item) => ({
    key: `misconception-${item.id}`,
    note: true,
    node: <MisconceptionNote item={{ ...item, check: keepUnits(item.check) }} />,
  }));
  return [
    {
      key: "explanation",
      node: (
        <Explanation
          eyebrow={description.eyebrow}
          title={description.title}
          body={description.body}
        />
      ),
    },
    {
      key: "events",
      node: (
        <div>
          <Label className="flex min-h-7 items-center justify-between gap-2.5">
            {LABELS.now} 사건
            {canReplay && (
              <Button variant="filled" size="sm" data-action="replay-event" onClick={onReplay}>
                {LABELS.now} 사건 다시 보기
              </Button>
            )}
          </Label>
          <List as="ul" id="current-events" className="[&>li]:min-h-9 [&>li]:px-0 [&>li]:py-1.5">
            {visibleEvents.length ? (
              visibleEvents.map((e, i) => (
                <li key={`${e.type}-${e.id}-${i}`}>
                  <Led color={colorOf(e.id)} />
                  <span>
                    {keepUnits(eventLabel(e, algorithm))}
                    {e === move && <span className="text-label-2"> · 이동 중</span>}
                  </span>
                </li>
              ))
            ) : (
              <li>
                <Led color={colorOf(frame.running)} />
                <span>
                  {frame.running
                    ? `${josa(frame.running, "가")} 다음 사건까지 실행을 이어갑니다.`
                    : "입출력이 끝나기를 기다립니다."}
                </span>
              </li>
            )}
            {notes.map((note) => (
              <li key={note} className="min-h-0! text-caption leading-[1.5]">
                <span className="text-label-2">{keepUnits(note)}</span>
              </li>
            ))}
          </List>
        </div>
      ),
    },
    {
      key: "insight",
      note: true,
      node: (
        <Note as="p" accent id="insight" className="text-pretty">
          <span>
            <b className="font-[750]">{LABELS.key}</b> · {keepUnits(key)}
          </span>
        </Note>
      ),
    },
    ...corrections,
  ];
}
