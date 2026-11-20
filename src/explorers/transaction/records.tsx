// 관찰 기록: 실행 순서 · 사건 기록 · 결과. The lesson draws each record
// (page.Timeline, page.Log, page.Results); this is the frame: tabs, the hint
// and the bodies that never scroll on the console.
import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import type { RecordProps, TxPage } from "./page.ts";

export type RecordTab = "timeline" | "log" | "results";

/** A records body: on the console it fills the plate and its rows window (useFollowRows). */
export const recordBodyClass = cn(
  "max-h-[420px] overflow-auto px-3.5 pt-3 pb-4 phone:p-3 phone:pb-4 phone:[&_td]:px-2 phone:[&_th]:px-2",
  "console:m-[4px_10px_10px] console:max-h-none console:min-h-0 console:flex-auto console:overflow-hidden console:p-0",
);

const panelClass = "console:flex console:min-h-0 console:flex-auto console:flex-col";

export function TxRecords({
  page,
  tab,
  onTab,
  ...props
}: RecordProps & { page: TxPage; tab: RecordTab; onTab: (tab: RecordTab) => void }) {
  const count = Math.max(0, props.snap.done);
  return (
    <Records aria-label="관찰 기록">
      <Tabs value={tab} onValueChange={(value) => onTab(value as RecordTab)}>
        <PlateHead>
          <TabsList aria-label="관찰 기록">
            <TabsTab value="timeline" data-record="timeline">
              실행 순서
            </TabsTab>
            <TabsTab value="log" data-record="log">
              사건 기록{" "}
              <span
                id="log-count"
                className={cn(
                  "inline-block min-w-[2ch] text-start tabular-nums",
                  tab !== "log" && "text-label-2",
                )}
              >
                {count}
              </span>
            </TabsTab>
            <TabsTab value="results" data-record="results">
              {page.resultsTab}
            </TabsTab>
          </TabsList>
          <Label className="whitespace-nowrap phone:hidden">기록을 눌러 그 사건으로 이동</Label>
        </PlateHead>
        <TabsPanel value="timeline" className={panelClass}>
          <page.Timeline {...props} />
        </TabsPanel>
        <TabsPanel value="log" className={panelClass}>
          <page.Log {...props} />
        </TabsPanel>
        <TabsPanel value="results" className={panelClass}>
          <page.Results {...props} />
        </TabsPanel>
      </Tabs>
    </Records>
  );
}
