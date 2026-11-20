// The 결과 record every lesson shares (large readout, facts, one reading) and
// the timeline's fixed column widths.
import { List, Readout } from "@/components/ui/content.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";

/** Fixed column widths (%) on the console, so columns never jump while rows fill in. */
export function timelineCols(widths: number[]) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col
          key={i}
          className="console:[width:var(--w)]"
          style={{ "--w": `${w}%` } as React.CSSProperties}
        />
      ))}
    </colgroup>
  );
}

export function ResultsBlock({
  label,
  lcd,
  facts,
  text,
}: {
  label: string;
  lcd: [string | number, string][];
  facts: [string, string][];
  text: string;
}) {
  return (
    <div
      id="record-results"
      className="px-3.5 pt-3 pb-4 phone:p-3 console:flex-auto console:overflow-hidden console:px-[18px] console:py-2"
    >
      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-8 gap-y-3.5 phone:grid-cols-1",
          "console:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.1fr)] console:gap-x-7 console:gap-y-0",
        )}
      >
        <div className="grid justify-items-start gap-2">
          <Label>{label}</Label>
          <Readout large>
            {lcd.map(([value, unit], k) => (
              <span key={k} className="inline-flex items-baseline gap-1">
                {k > 0 && " "}
                {value}
                <small>{unit}</small>
              </span>
            ))}
          </Readout>
        </div>
        <List
          as="ul"
          className="grid-cols-[max-content_minmax(0,1fr)] [&>*]:col-span-full [&>*]:grid [&>*]:grid-cols-subgrid [&>*]:items-baseline console:[&>*]:min-h-8 console:[&>*]:py-1"
        >
          {facts.map(([name, value]) => (
            <li key={name}>
              <span className="pe-5 text-label-2">{name}</span>
              <span className="tabular-nums">{value}</span>
            </li>
          ))}
        </List>
        <Text className="col-span-full console:col-auto">{text}</Text>
      </div>
    </div>
  );
}
