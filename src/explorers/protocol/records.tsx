// The records plate: the packet table, synced to playback, with the packet
// inspector opening as a second column beside it. Before playback no packet
// is shown (no result before it happens). On the console the table never
// scrolls: it shows the rows that fit, ending at the newest packet (or around
// the one being inspected).
import { useLayoutEffect, useRef } from "react";

import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Tag } from "@/components/ui/content.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Index, Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import type { ProtocolController, Snapshot } from "./controller.ts";
import { translate } from "./i18n.ts";
import { PacketInspector } from "./inspector.tsx";
import { getLessonPackets } from "./packets/encode.ts";
import { PACKET_COLORS } from "./simulation/network-drawing.ts";

const HEADINGS = ["NO.", "TIME", "SOURCE", "DESTINATION", "PROTOCOL", "INFO", "SIZE"];
const CONSOLE = "(min-width: 1100px) and (min-height: 700px)";

/** Show the window of rows that fits (port of fitPacketRows). */
function useFitRows(box: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const rows = [...el.querySelectorAll<HTMLTableRowElement>("tbody tr")];
      rows.forEach((row) => (row.hidden = false));
      if (!matchMedia(CONSOLE).matches || !rows.length) return;
      const head = el.querySelector("thead")!.getBoundingClientRect().height;
      const style = getComputedStyle(el);
      const room =
        el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - head - 2;
      const rowHeight = Math.max(
        ...rows.slice(0, 3).map((row) => row.getBoundingClientRect().height),
        1,
      );
      const count = Math.max(1, Math.floor(room / rowHeight));
      if (rows.length <= count) return;
      const inspected = rows.findIndex((row) => row.dataset.inspected !== undefined);
      let start = rows.length - count;
      if (inspected >= 0 && inspected < start)
        start = Math.max(0, inspected - Math.floor(count * 0.4));
      rows.forEach((row, i) => (row.hidden = i < start || i >= start + count));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the caller passes what the rows depend on
  }, deps);
}

export function ProtocolRecords({
  controller,
  snap,
}: {
  controller: ProtocolController;
  snap: Snapshot;
}) {
  const { lesson, playback, inspected } = snap;
  const packets = getLessonPackets(lesson);
  const shown = packets
    .map((packet, index) => ({ packet, index, status: playback?.packets[index] }))
    .filter(({ status }) => playback?.started && status !== "future");
  const box = useRef<HTMLDivElement>(null);
  useFitRows(box, [lesson.id, shown.length, inspected]);

  // A new packet scrolls the (stacked) table to its end.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && !matchMedia(CONSOLE).matches)
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown.length]);

  const inspect = (index: number) => controller.inspect(index);

  return (
    <Records
      aria-labelledby="records-label"
      data-inspecting={inspected !== null || undefined}
      className="pe-records packets flex flex-col"
    >
      <PlateHead className="flex-wrap">
        <Label id="records-label">
          <Index>C</Index> {translate("PACKET FLOW")}
        </Label>
        <div
          aria-label={translate("Colour key")}
          className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-caption text-label-2"
        >
          {(lesson.legend ?? []).map(([color, label]) =>
            color ? (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: PACKET_COLORS[color] }}
                />
                {translate(label)}
              </span>
            ) : (
              <span key={label}>{translate(label)}</span>
            ),
          )}
          <Label
            className={cn(
              "flex-none border-s border-separator ps-3.5 font-medium phone:hidden",
              inspected !== null && "console:hidden",
            )}
          >
            행을 누르면 바이트를 봅니다
          </Label>
        </div>
      </PlateHead>
      <div
        className={cn(
          "grid min-h-0 flex-auto grid-cols-[minmax(0,1fr)]",
          inspected !== null && "min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
          inspected !== null && "console:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]",
          "console:grid-rows-[minmax(0,1fr)]",
        )}
      >
        <div
          ref={box}
          className="pe-packet-box max-h-[420px] min-h-0 overflow-auto [scrollbar-width:thin] stacked:max-h-[300px] console:max-h-none"
        >
          <Table className="pe-packet-table">
            <colgroup>
              <col className="c-no" />
              <col className="c-time" />
              <col className="c-addr" />
              <col className="c-addr" />
              <col className="c-proto" />
              <col />
              <col className="c-len" />
            </colgroup>
            <thead>
              <tr>
                {HEADINGS.map((heading) => (
                  <Th key={heading}>{translate(heading)}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr className="pe-fade-in">
                  <Td colSpan={7} className="text-label-2">
                    {translate("No packets on the wire yet.")}
                  </Td>
                </tr>
              )}
              {shown.map(({ packet, index, status }) => {
                const row = packet.row!;
                const info = translate(row.info);
                return (
                  <tr
                    key={`${lesson.id}-${index}`}
                    data-packet={index}
                    data-clickable=""
                    data-lost={status === "lost" || undefined}
                    data-inspected={index === inspected || undefined}
                    aria-current={status === "current" ? "true" : undefined}
                    tabIndex={0}
                    className={cn(
                      rowClass,
                      "pe-fade-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    )}
                    onClick={() => inspect(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") inspect(index);
                    }}
                  >
                    <Td className="font-mono text-caption">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 flex-none rounded-full"
                          style={{ background: PACKET_COLORS[packet.color!] }}
                        />
                        {index + 1}
                      </span>
                    </Td>
                    <Td className="font-mono text-caption">{row.time}</Td>
                    <Td className="font-mono text-caption">{row.src}</Td>
                    <Td className="font-mono text-caption">{row.dst}</Td>
                    <Td className="font-medium">{row.proto}</Td>
                    <Td title={info}>
                      <span>{info}</span>
                      {packet.lost && (
                        <Tag className="ms-2 h-5 bg-[color-mix(in_srgb,var(--pk-lost)_14%,transparent)] text-[var(--pk-lost)]">
                          {translate("LOST")}
                        </Tag>
                      )}
                    </Td>
                    <Td className="font-mono text-caption">{row.len}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        {inspected !== null && (
          <PacketInspector
            key={lesson.id}
            controller={controller}
            lesson={lesson}
            index={inspected}
            lost={playback?.packets[inspected] === "lost"}
          />
        )}
      </div>
    </Records>
  );
}
