// 직접 실험 · 입력: the learner's head, range, direction, request queue and
// the two methods. Checked as typed (Korean messages under each field);
// applying opens the lesson with the input in the URL, so it can be shared.
import { useId, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Index, Label, Muted, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import {
  draftOf,
  MAX_MAX,
  MAX_REQUESTS,
  MIN_MAX,
  PRESETS,
  queryOf,
  validate,
  type CustomInput,
  type Draft,
} from "./custom-input.ts";
import { ALGORITHMS } from "./engine.ts";
import { fix } from "./format.ts";
import { ALL_NAMES, ALL_RULE_SHORT } from "./lesson-custom.ts";
import type { Algorithm, Direction } from "./types.ts";

const fieldClass = cn(
  "h-8 w-full min-w-0 rounded-small border-0 bg-fill-3 px-2.5 font-sans text-control text-label tabular-nums",
  "outline-none focus-visible:ring-focus aria-invalid:shadow-[inset_0_0_0_1.5px_var(--sys-red)]",
  "phone:h-[42px]",
);

export function InputSheet({
  open,
  onOpenChange,
  input,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: CustomInput;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-labelledby="input-title"
        className="console:w-[min(640px,calc(100vw-48px))]"
      >
        {open && <InputForm input={input} />}
      </SheetContent>
    </Sheet>
  );
}

function InputForm({ input }: { input: CustomInput }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(input));
  const [touched, setTouched] = useState(false);
  const id = useId();
  const result = validate(draft);
  const errors = result.ok || !touched ? {} : result.errors;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const count = draft.requests.split(/[\s,，、·]+/).filter(Boolean).length;
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!result.ok) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    location.assign(`${location.pathname}${queryOf(result.input)}`);
  };
  const error = (key: keyof typeof errors) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="m-0 text-caption text-[var(--sys-red)] keep-all">
        {errors[key]}
      </p>
    ) : null;
  const described = (key: keyof typeof errors, hint?: string) =>
    [errors[key] ? `${id}-${key}-error` : "", hint ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <form noValidate onSubmit={apply} className="flex min-h-0 flex-auto flex-col">
      <SheetHead>
        <Label>
          <Index>D</Index> {LABELS.custom} · 입력
        </Label>
      </SheetHead>
      <SheetBody>
        <SheetSection>
          <SheetTitle render={<Title id="input-title" className="mt-1" />}>
            내 요청 큐로 두 방식 비교하기
          </SheetTitle>
          <Text className="mt-1.5 text-label-2">
            요청은 모두 시작 전에 도착했다고 봅니다. 같은 입력을 두 방식이 처리하고,
            해설·비교·정리가 이 입력으로 다시 만들어집니다.
          </Text>
        </SheetSection>

        <SheetSection>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="p-0">
              <Label as="span">예제에서 시작</Label>
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 phone:grid-cols-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="filled"
                  data-preset={p.id}
                  className="h-auto min-h-11 flex-col items-start gap-0.5 rounded-note px-3 py-2 text-left whitespace-normal"
                  onClick={() => {
                    setDraft(draftOf(p.input));
                    setTouched(true);
                  }}
                >
                  <span>{p.label}</span>
                  <Muted className="text-caption font-normal">{p.note}</Muted>
                </Button>
              ))}
            </div>
          </fieldset>
        </SheetSection>

        <SheetSection className="grid grid-cols-2 gap-x-4 gap-y-3 phone:grid-cols-1">
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-head`}>
              <Label as="span">시작 헤드</Label>
            </label>
            <input
              id={`${id}-head`}
              name="head"
              inputMode="numeric"
              autoComplete="off"
              className={fieldClass}
              value={draft.head}
              aria-invalid={Boolean(errors.head)}
              aria-describedby={described("head")}
              onChange={(e) => set({ head: e.target.value })}
            />
            {error("head")}
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-max`}>
              <Label as="span">실린더 범위 0 –</Label>
            </label>
            <input
              id={`${id}-max`}
              name="max"
              inputMode="numeric"
              autoComplete="off"
              className={fieldClass}
              value={draft.max}
              aria-invalid={Boolean(errors.max)}
              aria-describedby={described("max", `${id}-max-hint`)}
              onChange={(e) => set({ max: e.target.value })}
            />
            <Muted id={`${id}-max-hint`} className="text-caption">
              마지막 실린더 {MIN_MAX}–{MAX_MAX}
            </Muted>
            {error("max")}
          </div>
          <div className="col-span-full grid gap-1.5">
            <Label id={`${id}-dir`}>시작할 때 헤드의 진행 방향</Label>
            <SegmentedControl<Direction>
              aria-labelledby={`${id}-dir`}
              value={draft.direction}
              onValueChange={(direction) => set({ direction })}
              className="grid w-full grid-cols-2"
            >
              <Segment value="down" data-direction="down">
                바깥쪽 · 0 쪽
              </Segment>
              <Segment value="up" data-direction="up">
                안쪽 · 큰 번호 쪽
              </Segment>
            </SegmentedControl>
            <Muted className="text-caption">SCAN · LOOK · C-SCAN이 먼저 쓰는 방향입니다.</Muted>
          </div>
          <div className="col-span-full grid gap-1.5">
            <div className="flex items-baseline gap-2">
              <label htmlFor={`${id}-requests`}>
                <Label as="span">요청 큐 (도착 순서)</Label>
              </label>
              <Muted className="ms-auto text-caption tabular-nums" id={`${id}-count`}>
                {count} / {MAX_REQUESTS}개
              </Muted>
            </div>
            <input
              id={`${id}-requests`}
              name="requests"
              autoComplete="off"
              className={fieldClass}
              value={draft.requests}
              placeholder="예: 98, 183, 37, 122"
              aria-invalid={Boolean(errors.requests)}
              aria-describedby={described("requests", `${id}-count`)}
              onChange={(e) => set({ requests: e.target.value })}
            />
            {error("requests")}
          </div>
        </SheetSection>

        <SheetSection className="grid gap-3">
          <Label as="p" className="m-0">
            비교할 두 방식
          </Label>
          {(["a", "b"] as const).map((key, i) => (
            <div key={key} className="grid gap-1.5">
              <Label id={`${id}-alg-${key}`} className="font-medium">
                {i ? "방식 B" : "방식 A"}
              </Label>
              <SegmentedControl<Algorithm>
                aria-labelledby={`${id}-alg-${key}`}
                value={draft[key]}
                onValueChange={(alg) => set({ [key]: alg })}
                className="grid w-full grid-cols-5 phone:grid-cols-3 phone:rounded-[14px]"
              >
                {ALGORITHMS.map((alg) => (
                  <Segment key={alg} value={alg} data-pick={`${key}-${alg}`} className="px-1.5">
                    {fix(ALL_NAMES[alg])}
                  </Segment>
                ))}
              </SegmentedControl>
              <Muted className="text-caption">{ALL_RULE_SHORT[draft[key]]}</Muted>
            </div>
          ))}
          {error("pair")}
        </SheetSection>
      </SheetBody>
      <SheetFoot>
        <SheetClose render={<Button variant="filled" type="button" />}>취소</SheetClose>
        <Button variant="primary" type="submit" data-action="apply-input">
          이 입력으로 실험
        </Button>
      </SheetFoot>
    </form>
  );
}
