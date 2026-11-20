// The six explorers, in learning order. Each is a page under /<slug>/.
// `tint` is its Apple system colour (theme tokens --sys-<tint>), `caption`
// the line under its name in the toolbar switcher.
export type ExplorerSlug = "protocol" | "cpu" | "memory" | "transaction" | "disk" | "git";

export interface Explorer {
  slug: ExplorerSlug;
  label: string;
  directory: string;
  tint: "blue" | "orange" | "green" | "pink" | "yellow" | "purple";
}

export const explorers: Explorer[] = [
  {
    slug: "protocol",
    label: "프로토콜 탐색기",
    directory: "protocol-explorer-source",
    tint: "blue",
  },
  {
    slug: "cpu",
    label: "CPU 스케줄링 탐색기",
    directory: "cpu-scheduling-explorer",
    tint: "orange",
  },
  { slug: "memory", label: "메모리 탐색기", directory: "memory-explorer", tint: "green" },
  {
    slug: "transaction",
    label: "트랜잭션 탐색기",
    directory: "transaction-explorer",
    tint: "pink",
  },
  {
    slug: "disk",
    label: "디스크 스케줄링 탐색기",
    directory: "disk-scheduling-explorer",
    tint: "yellow",
  },
  { slug: "git", label: "Git 탐색기", directory: "git-explorer", tint: "purple" },
];
