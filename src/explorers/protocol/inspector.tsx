// The packet inspector: a second column in the records plate. The packet's
// layers as a bar, its fields as a tree and its bytes as a hex dump; hovering
// a field lights its bytes and hovering a byte lights the tightest field.
// On the desktop console nothing scrolls: the tree pages and the byte view
// shows the rows that fit, starting at the first field on the tree's page.
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { Button } from "@/components/ui/button.tsx";
import { TabsList, TabsTab, Tabs } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/cn.ts";
import { usePagerState } from "@/lib/fit.ts";
import { useMediaQuery } from "@/lib/use-media-query.ts";
import type { ProtocolController } from "./controller.ts";
import { translate } from "./i18n.ts";
import { getEncodedLessonPackets, getLessonPackets, type EncodedFrame } from "./packets/encode.ts";
import { PACKET_COLORS } from "./simulation/network-drawing.ts";
import type { Lesson } from "./types.ts";

const CONSOLE = "(min-width: 1100px) and (min-height: 700px)";
const TALL = "(min-height: 1000px)";

const LAYER_COLORS: Record<string, string> = {
  eth: "slate",
  arp: "amber",
  ip: "blue",
  tcp: "green",
  udp: "green",
  icmp: "amber",
  tls: "teal",
  pad: "grey",
};
const layerColor = (id: string) => LAYER_COLORS[id] ?? "violet";
const LAYER_NAMES: Record<string, string> = {
  eth: "Ethernet",
  arp: "ARP",
  ip: "IPv4",
  tcp: "TCP",
  udp: "UDP",
  icmp: "ICMP",
  pad: "Padding",
  tls: "TLS",
};
const EXAMPLE_NOTE = "an example value: it differs in every real capture";
const UNKNOWN_NOTE = "bytes the lesson can’t show: encrypted, random, or a file’s contents";

interface Lit {
  from: number;
  to: number;
  field: number | null;
}

const hex4 = (n: number) => n.toString(16).padStart(4, "0");

export function PacketInspector({
  controller,
  lesson,
  index,
  lost,
}: {
  controller: ProtocolController;
  lesson: Lesson;
  index: number;
  lost: boolean;
}) {
  const onConsole = useMediaQuery(CONSOLE);
  const tall = useMediaQuery(TALL);
  const frame = getEncodedLessonPackets(lesson)[index];
  const packet = getLessonPackets(lesson)[index];
  const row = packet.row!;
  const [tab, setTab] = useState<"tree" | "hex">("tree");
  const [lit, setLit] = useState<Lit | null>(null);
  const [note, setNote] = useState("");
  const pager = usePager();
  const { page } = usePagerState(pager);
  const hexRef = useRef<HTMLDivElement>(null);
  const resetKey = `${lesson.id}:${index}`;

  const notes = [translate(frame.at)];
  if (frame.segments > 1) {
    notes.push(
      translate(
        "This row stands for {n} TCP segments carrying a {size}-byte message; the first segment is shown",
        { n: frame.segments, size: (frame.messageLength ?? 0).toLocaleString(translate("en-US")) },
      ),
    );
  }
  if (lost) notes.push(translate("This packet was lost on the way"));
  const where = notes.join(" · ");

  // Fields overlap (a header contains smaller fields); a byte lights the tightest one.
  const lightByte = (offset: number) => {
    const match = frame.fields
      .map((field, i) => [field, i] as const)
      .filter(([field]) => offset >= field.from && offset < field.to)
      .sort((a, b) => a[0].to - a[0].from - (b[0].to - b[0].from))[0];
    if (!match) return setLit({ from: offset, to: offset + 1, field: null });
    const [field, i] = match;
    setLit({ from: field.from, to: field.to, field: i });
    if (onConsole) pager.showKey(`f${i}`);
  };

  /* ----- the field tree: layer heads, then their fields ----- */
  const items: PagedItem[] = frame.layers.flatMap((layer) => {
    const head: PagedItem = {
      key: `l-${layer.id}-${layer.from}`,
      element: (
        <h4
          data-layer={layer.id}
          className={cn(
            `c-${layerColor(layer.id)}`,
            "m-0 flex items-baseline gap-2 pb-1 text-control font-semibold [&:not(:first-child)]:pt-2.5",
            "before:size-2 before:flex-none before:self-center before:rounded-full before:bg-[var(--c)] before:content-['']",
          )}
        >
          <span>{translate(layer.name)}</span>
          {layer.summary && (
            <em className="font-sans text-caption font-medium text-label-2 not-italic tabular-nums">
              {translate(layer.summary)}
            </em>
          )}
        </h4>
      ),
    };
    const fields = frame.fields
      .map((field, i) => [field, i] as const)
      .filter(([field]) => field.layer === layer.id && !field.hidden)
      .map(([field, i]): PagedItem => {
        const fieldNote = field.note ? translate(field.note) : "";
        const ranged = field.to > field.from;
        return {
          key: `f${i}`,
          element: (
            <div
              data-field={i}
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a field with a note takes focus to show it
              tabIndex={field.note ? 0 : undefined}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-separator-soft py-1 pr-2 pl-[11px] text-caption",
                field.depth === 1 && "pl-6",
                field.depth === 2 && "pl-9",
                lit?.field === i && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              )}
              onMouseEnter={() => {
                if (ranged) setLit({ from: field.from, to: field.to, field: i });
                setNote(fieldNote);
              }}
              onFocus={() => setNote(fieldNote)}
            >
              <span className={cn("text-label-2", field.heading && "font-semibold")}>
                {translate(field.name)}
                {field.note && onConsole && (
                  <span
                    aria-hidden="true"
                    className="ms-1.5 inline-grid size-4 place-items-center rounded-full bg-fill-3 align-[1px] font-sans text-[12px] leading-none font-semibold text-label-2"
                  >
                    i
                  </span>
                )}
              </span>
              <span
                className={cn("text-end font-mono break-all", field.mono && "whitespace-pre-wrap")}
              >
                {translate(field.value)}
                {field.example && (
                  <>
                    {" "}
                    <i
                      title={translate(EXAMPLE_NOTE)}
                      className="inline-block rounded-full bg-fill-3 px-1 font-sans text-caption font-medium text-label-2 not-italic"
                    >
                      {translate("E.G.")}
                    </i>
                  </>
                )}
              </span>
              {fieldNote && !onConsole && (
                <p className="col-span-full m-0 mt-0.5 text-caption leading-[1.5] text-label-2 keep-all">
                  {fieldNote}
                </p>
              )}
            </div>
          ),
        };
      });
    return [head, ...fields];
  });

  /* ----- the bytes: rows of 16 ----- */
  const layerAt = (offset: number) =>
    frame.layers.find((layer) => offset >= layer.from && offset < layer.to)?.id ?? "pad";
  const hexRows: number[] = [];
  for (let at = 0; at < frame.bytes.length; at += 16) hexRows.push(at);

  // The console shows the byte rows that fit, from the first field on the tree's page.
  useLayoutEffect(() => {
    const hex = hexRef.current;
    if (!hex) return;
    const fit = () => {
      const rows = [...hex.querySelectorAll<HTMLElement>("[data-hx-row]")];
      const range = hex.querySelector<HTMLElement>("[data-hx-range]");
      rows.forEach((r) => (r.hidden = false));
      if (range) range.textContent = "";
      if (!onConsole || !rows.length) return;
      const style = getComputedStyle(hex);
      const head = hex.querySelector<HTMLElement>("[data-hx-head]")!;
      const room =
        hex.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom) -
        head.offsetHeight -
        parseFloat(getComputedStyle(head).marginBottom);
      const rowHeight = rows[0].getBoundingClientRect().height || 1;
      const count = Math.max(1, Math.floor(room / rowHeight));
      if (rows.length <= count) return;
      const firstShown = [...pager.keys.entries()]
        .filter(([key, p]) => p === page && key.startsWith("f"))
        .map(([key]) => frame.fields[Number(key.slice(1))])
        .find((field) => field && field.to > field.from);
      const firstRow = Math.floor((firstShown?.from ?? 0) / 16);
      const start = Math.max(0, Math.min(firstRow, rows.length - count));
      rows.forEach((r, i) => (r.hidden = i < start || i >= start + count));
      if (range)
        range.textContent = `${hex4(start * 16)}–${hex4(Math.min((start + count) * 16, frame.bytes.length) - 1)}`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(hex);
    return () => observer.disconnect();
  });

  const isLit = (offset: number) => Boolean(lit && offset >= lit.from && offset < lit.to);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- leaving the inspector clears the lit bytes (pointer only)
    <section
      aria-label={translate("Packet inspector")}
      data-index={index}
      data-tab={tab}
      className="pe-inspector pe-fade-in flex min-w-0 flex-col border-separator-soft stacked:border-t console:min-h-0 min-[1100px]:border-s"
      onMouseLeave={() => setLit(null)}
    >
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5 console:pt-2.5 console:pb-1">
        <span
          className="inline-block size-2 flex-none rounded-full"
          style={{ background: PACKET_COLORS[packet.color!] }}
        />
        <span className="font-semibold text-label-2 tabular-nums">#{index + 1}</span>
        <div className="grid min-w-0 flex-1 leading-[1.35]" title={where}>
          <b className="truncate text-headline">{translate(packet.label!)}</b>
          <span className="truncate font-mono text-caption text-label-2">
            {row.time} · {row.src} → {row.dst} · {row.proto} · {row.len}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="filled"
            size="icon-sm"
            data-ins="prev"
            aria-label={translate("Previous packet")}
            title={translate("Previous packet (←)")}
            onClick={() => controller.stepInspector(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="filled"
            size="icon-sm"
            data-ins="next"
            aria-label={translate("Next packet")}
            title={translate("Next packet (→)")}
            onClick={() => controller.stepInspector(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <Button
            variant="filled"
            size="icon-sm"
            data-ins="close"
            aria-label={translate("Close")}
            title={translate("Close (Esc)")}
            onClick={controller.closeInspector}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="m-0 px-4 pb-2.5 text-caption text-label-2 console:hidden" title={where}>
        {where}
      </p>
      <div className="mx-4 mb-3 flex gap-[3px]">
        {frame.layers.map((layer) => {
          const length = layer.to - layer.from;
          return (
            <button
              key={`${layer.id}-${layer.from}`}
              type="button"
              data-layer={layer.id}
              title={translate(layer.name)}
              className={cn(
                `c-${layerColor(layer.id)}`,
                "flex min-w-0 cursor-pointer flex-col gap-px rounded-[6px] border-0 px-2 pt-[7px] pb-[5px] text-left text-caption text-label",
                "bg-[color-mix(in_srgb,var(--c)_10%,transparent)] shadow-[inset_0_3px_0_var(--c)] console:flex-row console:items-baseline console:gap-1.5",
              )}
              style={{ flex: Math.max(length, frame.bytes.length * 0.045) }}
              onClick={() => {
                setTab("tree");
                pager.showKey(`l-${layer.id}-${layer.from}`);
              }}
            >
              <b className="truncate font-semibold">
                {translate(LAYER_NAMES[layer.id] ?? layer.name.split(" ·")[0])}
              </b>
              <i className="font-sans font-medium text-label-2 not-italic tabular-nums">{length}</i>
            </button>
          );
        })}
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as "tree" | "hex")}>
        <TabsList aria-label="검사 보기" className="pe-ins-tabs mx-4 mb-1.5 self-start">
          <TabsTab value="tree" data-tab="tree">
            필드
          </TabsTab>
          <TabsTab value="hex" data-tab="hex">
            바이트
          </TabsTab>
        </TabsList>
      </Tabs>
      <div className="pe-ins-body min-h-0 flex-1 border-t border-separator-soft console:flex console:flex-col console:overflow-hidden">
        <div
          className={cn(
            "pe-ins-tree min-h-0 max-h-[340px] overflow-auto px-4 py-2.5 [scrollbar-width:thin] stacked:max-h-[220px]",
            "console:grid console:max-h-none console:flex-[2_1_0] console:grid-cols-[minmax(0,1fr)_auto] console:grid-rows-[minmax(0,1fr)_auto] console:overflow-hidden console:pb-1.5",
          )}
        >
          <PagedList
            pager={pager}
            resetKey={resetKey}
            items={items}
            className="col-span-full flex flex-col [&>[hidden]+h4]:pt-0"
          />
          {onConsole && (
            <p
              aria-live="polite"
              className="m-0 min-h-[1.5em] self-center overflow-hidden text-caption leading-[1.5] text-ellipsis whitespace-nowrap text-label-2"
            >
              {note || "ⓘ 표시가 있는 필드에 마우스를 올리면 설명이 나옵니다"}
            </p>
          )}
          <Pager pager={pager} label="필드 쪽" className="pt-1" />
        </div>
        <div
          ref={hexRef}
          className="pe-ins-hex min-h-0 max-h-[340px] overflow-auto px-4 py-2.5 [scrollbar-width:thin] stacked:max-h-[220px] console:max-h-none console:flex-[1_1_0] console:overflow-hidden console:py-2"
        >
          <div
            data-hx-head=""
            className="mb-1.5 font-mono text-caption font-medium text-label-2"
            title={`·· ${translate(UNKNOWN_NOTE)}`}
          >
            {translate("BYTES")} <span data-hx-range="" className="ms-1.5" />
            <span className="ms-1.5">
              {translate("{n} in this frame", { n: frame.bytes.length })}
            </span>
          </div>
          {hexRows.map((at) => (
            <HexRow
              key={at}
              frame={frame}
              at={at}
              layerAt={layerAt}
              isLit={isLit}
              onByte={lightByte}
            />
          ))}
        </div>
      </div>
      {(!onConsole || tall) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-separator-soft px-4 pt-2 pb-3 text-caption text-label-2">
          <span>
            <i className="inline-block rounded-full bg-fill-3 px-1 font-sans font-medium not-italic">
              {translate("E.G.")}
            </i>{" "}
            {translate(EXAMPLE_NOTE)}
          </span>
          <span>
            <b className="font-mono">··</b> {translate(UNKNOWN_NOTE)}
          </span>
        </div>
      )}
    </section>
  );
}

function HexRow({
  frame,
  at,
  layerAt,
  isLit,
  onByte,
}: {
  frame: EncodedFrame;
  at: number;
  layerAt: (offset: number) => string;
  isLit: (offset: number) => boolean;
  onByte: (offset: number) => void;
}) {
  const bytes = frame.bytes.slice(at, at + 16);
  return (
    <div
      data-hx-row=""
      className="flex gap-3 font-mono text-caption leading-[1.7] font-medium whitespace-nowrap phone:gap-2"
    >
      <span className="text-label-2">{hex4(at)}</span>
      <span className="grid grid-cols-[repeat(16,2.1ch)] gap-x-[0.55ch]">
        {bytes.map((byte, i) => (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- hovering a byte lights its field (pointer only; the tree is the keyboard path)
          <span
            key={i}
            data-i={at + i}
            data-unknown={byte === null || undefined}
            data-lit={isLit(at + i) || undefined}
            className={`pe-hx c-${layerColor(layerAt(at + i))}`}
            onMouseEnter={() => onByte(at + i)}
          >
            {byte === null ? "··" : byte.toString(16).padStart(2, "0")}
          </span>
        ))}
      </span>
      <span className="pe-hx-text grid grid-cols-[repeat(16,1ch)] text-label-2">
        {bytes.map((byte, i) => (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- as above
          <span
            key={i}
            data-i={at + i}
            data-unknown={byte === null || undefined}
            data-lit={isLit(at + i) || undefined}
            className="pe-as"
            onMouseEnter={() => onByte(at + i)}
          >
            {byte === null ? "·" : byte >= 32 && byte < 127 ? String.fromCharCode(byte) : "."}
          </span>
        ))}
      </span>
    </div>
  );
}
