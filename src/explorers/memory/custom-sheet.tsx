// 직접 실험: the form for the learner's own input (reference string, frame
// count, two policies). A Liquid Glass sheet; the input is checked as it is
// typed and the run starts only when it is valid. Submitting puts the
// configuration in the URL (custom.ts), so the run can be shared.
import { DeleteIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Note } from "@/components/ui/content.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Slider, SliderTicks } from "@/components/ui/slider.tsx";
import { Label, Muted, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import {
  CUSTOM_PAGES,
  CUSTOM_POLICIES,
  MAX_FRAMES,
  MAX_REFS,
  MIN_FRAMES,
  PRESETS,
  refsFromText,
  validateCustom,
  type CustomConfig,
} from "./custom.ts";
import { POLICY } from "./lessons.ts";
import { PageChip } from "./parts.tsx";
import { pageColor } from "./scene.ts";
import type { Algorithm } from "./types.ts";

/** A text field in content: the kit's rounded field on the group fill. */
export const fieldClass = cn(
  "h-8 w-full min-w-0 rounded-small border border-separator-soft bg-fill-4 px-2.5",
  "font-sans text-control text-label tracking-[0.12em] uppercase outline-none",
  "placeholder:tracking-normal placeholder:normal-case placeholder:text-label-3",
  "focus-visible:ring-focus aria-invalid:border-[var(--sys-red)] phone:h-[42px]",
);

export function MemoryCustomSheet({
  open,
  onOpenChange,
  config,
  problems,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The configuration running now (the form starts from it). */
  config: CustomConfig;
  /** Why the shared link could not be used, if it could not. */
  problems: string[];
  onRun: (config: CustomConfig) => void;
}) {
  const ids = useId();
  const [text, setText] = useState(config.refs.join(" "));
  const [frames, setFrames] = useState(config.frames);
  const [policies, setPolicies] = useState<[Algorithm, Algorithm]>(config.policies);
  const refs = refsFromText(text);
  const errors = validateCustom({ refs, frames, policies });
  const refsError = errors.find((e) => /접근|페이지/.test(e));
  const policyError = errors.find((e) => /정책/.test(e));
  const load = (c: CustomConfig) => {
    setText(c.refs.join(" "));
    setFrames(c.frames);
    setPolicies(c.policies);
  };
  const append = (page: string) =>
    setText((t) => (refsFromText(t).length >= MAX_REFS ? t : `${t.trim()} ${page}`.trim()));
  const removeLast = () => setText((t) => refsFromText(t).slice(0, -1).join(" "));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby={`${ids}-title`} className="w-[min(620px,calc(100vw-24px))]">
        <SheetHead>
          <Label>{LABELS.custom} · 같은 입력 · 두 정책</Label>
        </SheetHead>
        <form
          className="flex min-h-0 flex-auto flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!errors.length) onRun({ refs, frames, policies });
          }}
        >
          <SheetBody>
            <SheetSection>
              <SheetTitle render={<Title id={`${ids}-title`} />}>실험 조건 바꾸기</SheetTitle>
              <Text className="mt-1 text-label-2">
                접근 순서와 프레임 수, 비교할 두 정책을 고르면 같은 장면과 기록으로 실행합니다. 주소
                창의 링크로 이 실험을 그대로 공유할 수 있습니다.
              </Text>
              {problems.length > 0 && (
                <Note as="div" className="mt-2.5">
                  공유된 링크의 조건을 쓸 수 없어 기본 조건으로 실행했습니다. {problems.join(" ")}
                </Note>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Label className="me-1">예시</Label>
                {PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="filled"
                    size="sm"
                    data-preset={p.id}
                    onClick={() => load(p.config)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </SheetSection>

            <SheetSection>
              <div className="flex items-baseline justify-between gap-2">
                <Label id={`${ids}-refs-label`}>
                  접근 순서 <Muted>· 페이지 A~H, {MAX_REFS}번까지</Muted>
                </Label>
                <Label className="tabular-nums" aria-live="polite">
                  {refs.length} / {MAX_REFS}
                </Label>
              </div>
              <input
                id={`${ids}-refs`}
                aria-labelledby={`${ids}-refs-label`}
                name="refs"
                data-custom="refs"
                className={cn(fieldClass, "mt-1.5")}
                value={text}
                autoComplete="off"
                spellCheck={false}
                placeholder="예: A B C A D A B E A B"
                aria-invalid={refsError ? true : undefined}
                aria-describedby={`${ids}-refs-help`}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {CUSTOM_PAGES.map((page) => (
                  <Button
                    key={page}
                    type="button"
                    variant="filled"
                    size="icon"
                    data-page-key={page}
                    aria-label={`페이지 ${page} 추가`}
                    className="font-bold"
                    style={{ color: pageColor(page) }}
                    disabled={refs.length >= MAX_REFS}
                    onClick={() => append(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="filled"
                  size="sm"
                  className="ms-1"
                  disabled={!refs.length}
                  onClick={removeLast}
                >
                  <DeleteIcon aria-hidden="true" />
                  하나 지우기
                </Button>
                <Button
                  type="button"
                  variant="filled"
                  size="sm"
                  disabled={!text}
                  onClick={() => setText("")}
                >
                  모두 지우기
                </Button>
              </div>
              <p
                id={`${ids}-refs-help`}
                className="m-0 mt-2 flex min-h-6 flex-wrap items-center gap-1"
                aria-live="polite"
              >
                {refsError ? (
                  <span role="alert" className="text-control text-[var(--sys-red)] keep-all">
                    {refsError}
                  </span>
                ) : (
                  refs.map((page, i) => <PageChip key={i} page={page} />)
                )}
              </p>
            </SheetSection>

            <SheetSection className="grid gap-4 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <div className="grid content-start gap-1.5">
                <Label id={`${ids}-frames`} className="justify-between">
                  RAM 프레임 수 <output className="text-label tabular-nums">{frames}개</output>
                </Label>
                <Slider
                  min={MIN_FRAMES}
                  max={MAX_FRAMES}
                  step={1}
                  value={frames}
                  thumbLabel="RAM 프레임 수"
                  thumbProps={{ "aria-valuetext": `프레임 ${frames}개` }}
                  onValueChange={(value) => setFrames(value as number)}
                />
                <SliderTicks>
                  <span>{MIN_FRAMES}</span>
                  <span>{MAX_FRAMES}</span>
                </SliderTicks>
              </div>
              <div className="grid content-start gap-1.5">
                {([0, 1] as const).map((slot) => (
                  <div key={slot} className="flex items-center justify-between gap-2.5">
                    <Label id={`${ids}-p${slot}`}>정책 {slot + 1}</Label>
                    <SegmentedControl
                      aria-labelledby={`${ids}-p${slot}`}
                      value={policies[slot]}
                      data-custom={`policy-${slot}`}
                      onValueChange={(value: Algorithm) =>
                        setPolicies((p) => (slot ? [p[0], value] : [value, p[1]]))
                      }
                    >
                      {CUSTOM_POLICIES.map((algorithm) => (
                        <Segment key={algorithm} value={algorithm} data-policy={algorithm}>
                          {POLICY[algorithm]}
                        </Segment>
                      ))}
                    </SegmentedControl>
                  </div>
                ))}
                {policyError && (
                  <span role="alert" className="text-control text-[var(--sys-red)] keep-all">
                    {policyError}
                  </span>
                )}
              </div>
            </SheetSection>
          </SheetBody>
          <SheetFoot>
            <Button type="button" variant="filled" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              data-action="custom-run"
              disabled={errors.length > 0}
            >
              이 조건으로 실행
            </Button>
          </SheetFoot>
        </form>
      </SheetContent>
    </Sheet>
  );
}
