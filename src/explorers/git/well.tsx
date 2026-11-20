// The file panel: welcome.txt as it sits in each place, like a small code
// editor floating on the stage. Three sections (작업 트리 / 인덱스 / HEAD 커밋),
// each a header over numbered lines. A line is tinted with the system colour
// of whoever wrote it; conflict markers are red. On the desktop console it
// stands beside the scene as one column; when it is too short for every line
// it drops the lines that never change (data-compact), then tightens
// (data-tight) — set imperatively, like the vanilla fitWell().
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/cn.ts";
import { lineKinds } from "./engine.ts";
import { headCommit, titleOf } from "./format.ts";
import type { Lesson } from "./lesson-model.ts";
import { kindOfFor } from "./scene.ts";
import type { GitState, StageKey } from "./types.ts";

const DESKTOP = "(min-width: 1100px) and (min-height: 700px)";

const tinted =
  "bg-[color-mix(in_srgb,var(--git-row)_13%,transparent)] shadow-[inset_3px_0_var(--git-row)]";
const KIND_CLASS: Record<string, string> = {
  plain: "is-plain text-label-2 console:group-data-compact/well:hidden",
  base: "is-base",
  main: cn("is-main [--git-row:var(--git-main)]", tinted),
  feature: cn("is-feature [--git-row:var(--git-feature)]", tinted),
  both: cn("is-both [--git-row:var(--accent)]", tinted),
  conflict: cn("is-conflict [--git-row:var(--git-conflict)]", tinted),
  marker: cn(
    "is-marker [--git-row:var(--git-conflict)] font-mono font-semibold text-[var(--git-marker-ink)]",
    tinted,
  ),
};
const lineClass = cn(
  "grid grid-cols-[20px_minmax(0,1fr)] gap-2 py-px pr-3.5 pl-2 font-sans text-label keep-all [overflow-wrap:anywhere]",
  "console:group-data-tight/well:py-0",
);
const lnClass = (changed = false) =>
  cn(
    "git-ln text-right font-sans text-label-3 tabular-nums",
    changed && "font-bold text-accent-text",
  );

function Column({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 pt-2.5 pb-3 [&+&]:border-s [&+&]:border-separator-soft",
        "phone:[&+&]:border-s-0 phone:[&+&]:border-t console:[&+&]:border-s-0 console:[&+&]:border-t",
        "console:py-2.5 console:group-data-compact/well:pt-[7px] console:group-data-compact/well:pb-2 console:group-data-tight/well:py-1",
      )}
    >
      <span
        className={cn(
          "mb-1.5 block border-b border-separator-soft px-3.5 pb-[7px] font-semibold text-label-2",
          "console:group-data-compact/well:mb-1 console:group-data-compact/well:pb-[5px]",
          "console:group-data-tight/well:mb-0.5 console:group-data-tight/well:pb-[3px]",
        )}
      >
        {head}
      </span>
      <ol className="m-0 grid list-none p-0">{children}</ol>
    </div>
  );
}

export function FileWell({ lesson, state }: { lesson: Lesson; state: GitState }) {
  const ref = useRef<HTMLDivElement>(null);
  const head = headCommit(state);
  const kindOf = kindOfFor(lesson.layout);

  /** One snapshot as numbered lines, each in the colour of whoever wrote it. */
  const fileLines = (content: string, headContent?: string) => {
    const headLines = headContent?.trimEnd().split("\n") ?? [];
    const lines = lineKinds(content, lesson.layout.versions);
    return lines.map(({ text, kind, auto }, i) => {
      const changed =
        headContent != null && lines.length === headLines.length && text !== headLines[i];
      return (
        <li key={i} className={cn(lineClass, KIND_CLASS[kind], changed && "is-changed")}>
          <span className={lnClass(changed)}>{i + 1}</span>
          <span>
            {text}
            {auto && (
              <span className="ms-2 inline-block rounded-full bg-fill-2 px-[7px] font-sans text-caption leading-[1.5] font-medium text-label-2">
                자동 병합
              </span>
            )}
          </span>
        </li>
      );
    });
  };

  let index: React.ReactNode;
  if (state.index.stages) {
    const stages = state.index.stages;
    const rows = (
      [
        ["1", "base", "공통 조상"],
        ["2", "ours", "현재 main"],
        ["3", "theirs", "가져올 쪽"],
      ] as [string, StageKey, string][]
    )
      .filter(([, key]) => stages[key])
      .map(([n, key, label]) => {
        const content = stages[key]!;
        return (
          <li key={key} className={cn(lineClass, KIND_CLASS[kindOf(content)])}>
            <span className={lnClass()}>{n}</span>
            <span className="flex flex-wrap gap-x-2 console:group-data-tight/well:gap-x-1.5">
              <span className="font-sans text-label-2">
                {label} {state.merge?.[key] ?? ""}
              </span>
              {titleOf(content)}
            </span>
          </li>
        );
      });
    const heading =
      state.index.status === "comparing" ? "인덱스 · 세 버전 기록 중" : "인덱스 · stage 1·2·3";
    index = (
      <Column head={heading}>
        {rows.length ? (
          rows
        ) : (
          <li className={lineClass}>
            <span className={lnClass()} />
            <span>…</span>
          </li>
        )}
      </Column>
    );
  } else {
    index = <Column head="인덱스">{fileLines(state.index.content!, head.content)}</Column>;
  }

  // Beside a short scene the well drops the lines that never change.
  useLayoutEffect(() => {
    const well = ref.current;
    if (!well) return;
    const fitWell = () => {
      delete well.dataset.compact;
      delete well.dataset.tight;
      if (!window.matchMedia(DESKTOP).matches) return;
      if (well.scrollHeight > well.clientHeight + 1) well.dataset.compact = "";
      if (well.scrollHeight > well.clientHeight + 1) well.dataset.tight = "";
    };
    fitWell();
    const stage = well.closest('[data-plate="stage"]') ?? well;
    const observer = new ResizeObserver(fitWell);
    observer.observe(stage);
    return () => observer.disconnect();
  });

  return (
    <div
      ref={ref}
      id="well"
      aria-label="welcome.txt 내용"
      className={cn(
        "group/well relative z-[1] mx-5 mt-1 mb-[18px] grid grid-cols-3 overflow-hidden rounded-group bg-window p-0",
        "text-caption leading-[1.55] text-label",
        "shadow-[0_0_0_1px_var(--separator),0_8px_30px_rgb(0_0_0/0.08)]",
        "dark:bg-[color-mix(in_srgb,var(--window)_90%,white)] dark:shadow-[0_0_0_1px_var(--separator),0_8px_30px_rgb(0_0_0/0.35)]",
        "phone:mx-3.5 phone:mb-3.5 phone:grid-cols-1",
        "console:m-0 console:me-1 console:max-h-[calc(100%-16px)] console:grid-cols-1 console:self-center console:leading-[1.45] console:[grid-area:2/2]",
        "console:data-tight:leading-[1.25]",
      )}
    >
      <Column head="작업 트리">{fileLines(state.working, head.content)}</Column>
      {index}
      <Column head={`HEAD 커밋 ${head.id}`}>{fileLines(head.content)}</Column>
    </div>
  );
}
