// 직접 실험: the form for the learner's own jobs (arrival and alternating
// CPU / I/O bursts, up to five), the RR quantum and the two methods to
// compare. A Liquid Glass sheet; each field is checked as it is typed and the
// run starts only when everything is valid. Submitting puts the configuration
// in the URL (custom.ts), so the run can be shared.
import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Led, Note } from "@/components/ui/content.tsx";
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
  CUSTOM_METHODS,
  MAX_ARRIVAL,
  MAX_BURST,
  MAX_JOBS,
  MAX_QUANTUM,
  MIN_QUANTUM,
  PRESETS,
  burstsFromText,
  jobText,
  validateCustom,
  type CustomConfig,
} from "./custom.ts";
import { colorOf } from "./format.ts";
import { METHODS } from "./lessons.ts";
import type { Algorithm } from "./types.ts";

/** A text field in content: the kit's rounded field on the group fill. */
const fieldClass = cn(
  "h-8 w-full min-w-0 rounded-small border border-separator-soft bg-fill-4 px-2.5",
  "font-sans text-control text-label tabular-nums outline-none",
  "placeholder:text-label-3 focus-visible:ring-focus aria-invalid:border-[var(--sys-red)] phone:h-[42px]",
);

interface Row {
  key: number;
  arrival: string;
  bursts: string;
}

const rowsOf = (config: CustomConfig): Row[] =>
  config.jobs.map((job, i) => ({ key: i, arrival: String(job.arrival), bursts: jobText(job) }));

export function CpuCustomSheet({
  open,
  onOpenChange,
  config,
  problems,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CustomConfig;
  /** Why the shared link could not be used, if it could not. */
  problems: string[];
  onRun: (config: CustomConfig) => void;
}) {
  const ids = useId();
  const [rows, setRows] = useState<Row[]>(() => rowsOf(config));
  const [nextKey, setNextKey] = useState(rows.length);
  const [quantum, setQuantum] = useState(config.quantum);
  const [methods, setMethods] = useState<[Algorithm, Algorithm]>(config.methods);
  const jobs = rows.map((row) => ({
    arrival: /^\d+$/.test(row.arrival.trim()) ? Number(row.arrival) : Number.NaN,
    bursts: burstsFromText(row.bursts),
  }));
  const check = validateCustom({ jobs, quantum, methods });
  const hasRr = methods.includes("rr");
  const load = (c: CustomConfig) => {
    setRows(rowsOf(c).map((row) => ({ ...row, key: nextKey + row.key })));
    setNextKey(nextKey + c.jobs.length);
    setQuantum(c.quantum);
    setMethods(c.methods);
  };
  const edit = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby={`${ids}-title`} className="w-[min(640px,calc(100vw-24px))]">
        <SheetHead>
          <Label>{LABELS.custom} · 같은 작업 · 두 방식</Label>
        </SheetHead>
        <form
          className="flex min-h-0 flex-auto flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!check.all.length) onRun({ jobs, quantum, methods });
          }}
        >
          <SheetBody>
            <SheetSection>
              <SheetTitle render={<Title id={`${ids}-title`} />}>작업 바꾸기</SheetTitle>
              <Text className="mt-1 text-label-2">
                작업마다 도착 시각과 CPU·입출력 구간을 적으면 같은 장면과 기록으로 실행합니다. 주소
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
              <div
                className="grid grid-cols-[44px_88px_minmax(0,1fr)_28px] items-center gap-x-2.5 gap-y-1.5 phone:grid-cols-[40px_64px_minmax(0,1fr)_42px]"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a small editable table of jobs
                role="group"
                aria-label="작업 목록"
              >
                <Label>작업</Label>
                <Label id={`${ids}-arrival`}>도착 (ms)</Label>
                <Label id={`${ids}-bursts`}>
                  구간 (ms) <Muted>· CPU 입출력 CPU … 순서</Muted>
                </Label>
                <span />
                {rows.map((row, i) => {
                  const id = `P${i + 1}`;
                  const errors = check.jobs[i] ?? [];
                  return (
                    <div key={row.key} className="contents" data-custom-job={id}>
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Led color={colorOf(id)} />
                        {id}
                      </span>
                      <input
                        className={fieldClass}
                        inputMode="numeric"
                        data-custom="arrival"
                        aria-label={`${id} 도착 시각`}
                        aria-invalid={errors.some((e) => e.includes("도착")) || undefined}
                        value={row.arrival}
                        onChange={(event) => edit(row.key, { arrival: event.target.value })}
                      />
                      <input
                        className={fieldClass}
                        data-custom="bursts"
                        aria-label={`${id} CPU·입출력 구간`}
                        placeholder="예: 5 4 3"
                        aria-invalid={errors.some((e) => !e.includes("도착")) || undefined}
                        autoComplete="off"
                        value={row.bursts}
                        onChange={(event) => edit(row.key, { bursts: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="plain"
                        size="icon-sm"
                        aria-label={`${id} 빼기`}
                        disabled={rows.length === 1}
                        onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                      {errors.length > 0 && (
                        <span
                          role="alert"
                          className="col-span-3 col-start-2 text-caption text-[var(--sys-red)] keep-all"
                        >
                          {errors.join(" ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="filled"
                  size="sm"
                  data-action="custom-add-job"
                  disabled={rows.length >= MAX_JOBS}
                  onClick={() => {
                    setRows((list) => [...list, { key: nextKey, arrival: "0", bursts: "3" }]);
                    setNextKey(nextKey + 1);
                  }}
                >
                  <PlusIcon aria-hidden="true" />
                  작업 추가
                </Button>
                <Label>
                  작업 {MAX_JOBS}개까지 · 도착 0~{MAX_ARRIVAL} · 구간 1~{MAX_BURST} · 홀수 개(CPU로
                  끝)
                </Label>
              </div>
            </SheetSection>

            <SheetSection className="grid gap-4 min-[560px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-1.5">
                {([0, 1] as const).map((slot) => (
                  <div key={slot} className="flex items-center justify-between gap-2.5">
                    <Label id={`${ids}-m${slot}`}>방식 {slot + 1}</Label>
                    <SegmentedControl
                      aria-labelledby={`${ids}-m${slot}`}
                      value={methods[slot]}
                      data-custom={`method-${slot}`}
                      onValueChange={(value: Algorithm) =>
                        setMethods((m) => (slot ? [m[0], value] : [value, m[1]]))
                      }
                    >
                      {CUSTOM_METHODS.map((m) => (
                        <Segment key={m} value={m} data-method={m} className="px-2.5">
                          {m === "rr" ? "RR" : METHODS[m].label}
                        </Segment>
                      ))}
                    </SegmentedControl>
                  </div>
                ))}
                {check.methods && (
                  <span role="alert" className="text-control text-[var(--sys-red)] keep-all">
                    {check.methods}
                  </span>
                )}
              </div>
              <div className="grid content-start gap-1.5">
                <Label id={`${ids}-q`} className="justify-between">
                  시간 할당량{" "}
                  <output className={cn("tabular-nums", hasRr ? "text-label" : "text-label-2")}>
                    {hasRr ? `${quantum} ms` : "RR에서만"}
                  </output>
                </Label>
                <Slider
                  min={MIN_QUANTUM}
                  max={MAX_QUANTUM}
                  step={1}
                  value={quantum}
                  disabled={!hasRr}
                  thumbLabel="시간 할당량"
                  thumbProps={{ "aria-valuetext": `${quantum}밀리초` }}
                  onValueChange={(value) => setQuantum(value as number)}
                />
                <SliderTicks>
                  <span>{MIN_QUANTUM}</span>
                  <span>{MAX_QUANTUM}</span>
                </SliderTicks>
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
              disabled={check.all.length > 0}
            >
              이 조건으로 실행
            </Button>
          </SheetFoot>
        </form>
      </SheetContent>
    </Sheet>
  );
}
