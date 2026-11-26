// 오개념 바로잡기 (docs/DESIGN.md → Learning model): a belief learners
// commonly hold, set right with what the experiment shows. The 해설 shows one
// at its 핵심 장면; 정리 lists them all.
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS, type Misconception } from "@/lib/lesson-kit.ts";

export function MisconceptionNote({
  item,
  className,
}: {
  item: Misconception;
  className?: string;
}) {
  return (
    <div
      data-misconception={item.id}
      className={cn(
        "m-0 grid gap-1.5 rounded-note bg-fill-3 px-3 py-2.5 text-control leading-[1.55] text-label keep-all text-pretty",
        className,
      )}
    >
      <Label className="block">{LABELS.misconception}</Label>
      <p className="m-0 flex gap-2">
        <span aria-hidden="true" className="flex-none font-bold text-[var(--sys-red)]">
          ✕
        </span>
        <span>
          <span className="sr-only">{LABELS.misconceptionWrong}: </span>
          <s className="text-label-2 decoration-label-3">{item.wrong}</s>
        </span>
      </p>
      <p className="m-0 flex gap-2">
        <span aria-hidden="true" className="flex-none font-bold text-[var(--sys-green)]">
          ✓
        </span>
        <span>
          <span className="sr-only">{LABELS.misconceptionRight}: </span>
          <b className="font-semibold">{item.right}</b>
        </span>
      </p>
      <Text className="m-0 text-label-2">
        {LABELS.misconceptionCheck} · {item.check}
      </Text>
    </div>
  );
}

/** The misconceptions whose 핵심 장면 is \`scene\` (1-based). */
export function misconceptionsAt(items: readonly Misconception[] | undefined, scene: number) {
  return (items ?? []).filter((item) => item.scene === scene);
}
