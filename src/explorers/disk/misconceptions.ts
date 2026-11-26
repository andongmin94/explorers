// 오개념 바로잡기 for lessons 01–03: beliefs learners commonly bring to disk
// scheduling, each set right with numbers taken from this lesson's runs
// (never typed in, so they cannot drift from the engine). `scene` is the
// 1-based 핵심 장면 of `algorithm` where the run shows it.
// Sources: Silberschatz 10th ed. 11.2 (HDD scheduling), OSTEP 37.5, 44 (SSD).
import { josa } from "@/lib/josa.ts";
import { passedOver, pick, shortestTotal, worstWait } from "./engine.ts";
import { farthest, turnOf } from "./lesson-custom.ts";
import type { Algorithm, DiskInput, DiskMisconception, Milestone, Run, Step } from "./types.ts";

type Scenes = (alg: Algorithm) => Milestone[];

const sceneAt = (scenes: Scenes, alg: Algorithm, n: number) => {
  const k = scenes(alg).findIndex((m) => m.n === n);
  if (k < 0) throw new RangeError(`no 핵심 장면 at ${alg}:${n}`);
  return k + 1;
};
const lastScene = (scenes: Scenes, alg: Algorithm) => scenes(alg).length;
const legs = (step: Step) => step.path.slice(1).map((c, i) => Math.abs(c - step.path[i]));
const eun = (w: string) => josa(w, "은/는");
/** "…칸과 같고" / "…칸보다 길고" / "…칸보다 짧고": a compared to b (after "칸"). */
const versus = (a: number, b: number) => (a === b ? "과 같고" : a > b ? "보다 길고" : "보다 짧고");
const versusEnd = (a: number, b: number) =>
  a === b ? "과 같습니다" : a > b ? "보다 깁니다" : "보다 짧습니다";

/** Lesson 01: FCFS vs SSTF. */
export function fcfsSstfMisconceptions(
  input: DiskInput,
  runs: Record<string, Run>,
  scenes: Scenes,
): DiskMisconception[] {
  const { fcfs, sstf } = runs;
  const best = shortestTotal(input.requests, input.head);
  const far = farthest(input);

  // FCFS: the first move that passes pending requests without serving them.
  const passing = scenes("fcfs")
    .map((m) => fcfs.steps[m.n])
    .find((s) => s.index > 0 && passedOver(s).length > 0)!;
  // SSTF: the close call that flips the direction, and the long way back.
  const close = sstf.steps.find(
    (s) => s.index > 1 && s.candidates[1] && s.candidates[1].distance - s.distance <= 2,
  )!;
  const back = sstf.steps.slice(1).reduce((a, b) => (b.distance > a.distance ? b : a));
  const lookTotal = pickTotal("look", input);
  const lo = Math.min(input.head, ...input.requests);
  const hi = Math.max(input.head, ...input.requests);
  const bestRoute =
    input.head - lo <= hi - input.head
      ? `${input.head} → ${lo} → ${hi}`
      : `${input.head} → ${hi} → ${lo}`;
  return [
    {
      id: "fcfs-passing",
      algorithm: "fcfs",
      scene: sceneAt(scenes, "fcfs", passing.index),
      wrong: "FCFS라도 헤드가 지나가는 길에 있는 요청은 함께 처리한다.",
      right: "FCFS는 큐 맨 앞의 요청만 보고 갑니다. 지나가는 길의 요청도 자기 차례를 기다립니다.",
      check: `${passing.index === 1 ? "첫" : `${passing.index}번째`} 이동 ${passing.path.join(" → ")}(${passing.distance}칸)에서 ${passedOver(
        passing,
      )
        .map((r) => r.cylinder)
        .join("·")}번 위를 지났지만 처리하지 않았습니다.`,
    },
    {
      id: "sstf-direction",
      algorithm: "sstf",
      scene: sceneAt(scenes, "sstf", close.index),
      wrong: "SSTF는 한 방향으로 가까운 요청을 차례로 쓸고 간다.",
      right: "SSTF는 방향을 기억하지 않습니다. 양쪽 거리만 비교해 근소한 차이로도 돌아섭니다.",
      check: `헤드 ${close.before.head}에서 ${close.state.head}번 ${close.distance}칸, ${close.candidates[1].cylinder}번 ${close.candidates[1].distance}칸 — ${close.candidates[1].distance - close.distance}칸 차이로 ${Math.sign(close.state.head - close.before.head) < 0 ? "바깥쪽" : "안쪽"} ${close.state.head}번으로 돌아섰습니다.`,
    },
    {
      id: "sstf-fair",
      algorithm: "sstf",
      scene: sceneAt(scenes, "sstf", back.index),
      wrong: "SSTF도 결국 모든 요청을 금방 처리하니 공정하다(기아가 없다).",
      right: "가까운 요청이 계속 들어오면 SSTF는 먼 요청을 끝없이 미룰 수 있습니다(기아).",
      check: `요청 ${back.index}개를 처리하는 동안 처음 헤드에서 가장 먼 ${eun(`${far}번`)} 한 번도 뽑히지 않았습니다.`,
    },
    {
      id: "sstf-optimal",
      algorithm: "sstf",
      scene: lastScene(scenes, "sstf"),
      wrong: "SSTF는 매번 가장 가까운 요청을 고르므로 전체 이동도 항상 최소다.",
      right: "매번의 최선이 전체의 최선은 아닙니다(탐욕적 선택). 더 짧은 순서가 있을 수 있습니다.",
      check: `SSTF ${sstf.total}칸. 같은 입력의 최소는 ${best}칸(${bestRoute}${lookTotal === best ? ", 레슨 02의 LOOK" : ""})입니다.`,
    },
  ];
}

const pickTotal = (alg: Algorithm, input: DiskInput) => {
  // A full run of another method on the same input (for a comparison in a check).
  let head = input.head;
  let direction = input.direction;
  let total = 0;
  const pending = input.requests.map((cylinder, i) => ({ id: i + 1, cylinder }));
  while (pending.length) {
    const p = pick(alg, pending, head, direction, { max: input.max })!;
    total += p.path.slice(1).reduce((s, c, i) => s + Math.abs(c - p.path[i]), 0);
    head = p.request.cylinder;
    direction = p.direction;
    pending.splice(
      pending.findIndex((r) => r.id === p.request.id),
      1,
    );
  }
  return total;
};

/** Lessons 02 (SCAN vs LOOK) and 03 (C-SCAN vs SCAN). */
export function sweepMisconceptions(
  kind: "scan-look" | "cscan",
  input: DiskInput,
  runs: Record<string, Run>,
  scenes: Scenes,
): DiskMisconception[] {
  const { scan } = runs;
  const edge = input.direction === "down" ? 0 : input.max;
  const first = scan.steps[1];
  const sstf = pick("sstf", first.before.pending, input.head, input.direction)!.request;
  const sstfTotal = pickTotal("sstf", input);
  const scanTurn = scan.steps[turnOf(scan)];
  if (kind === "scan-look") {
    const { look } = runs;
    const lookTurn = look.steps[turnOf(look)];
    const far = farthest(input);
    const farId = input.requests.indexOf(far) + 1;
    const farPos = look.waits.findIndex((w) => w.id === farId) + 1;
    return [
      {
        id: "scan-nearest",
        algorithm: "scan",
        scene: sceneAt(scenes, "scan", 1),
        wrong: "SCAN도 가장 가까운 요청부터 처리한다.",
        right: "SCAN·LOOK은 진행 방향을 먼저 보고, 그 방향의 요청 중 가까운 것을 고릅니다.",
        check: `가장 가까운 것은 ${sstf.cylinder}번(${Math.abs(sstf.cylinder - input.head)}칸)이지만 ${input.direction === "down" ? "바깥쪽" : "안쪽"}으로 가던 SCAN은 ${first.request!.cylinder}번(${first.distance}칸)을 먼저 처리했습니다.`,
      },
      {
        id: "scan-edge",
        algorithm: "scan",
        scene: sceneAt(scenes, "scan", scanTurn.index),
        wrong: "SCAN은 마지막 요청에서 바로 방향을 바꾼다(LOOK과 같다).",
        right: `SCAN은 그 방향에 요청이 없어도 끝(${edge})까지 간 뒤 돕니다. 마지막 요청에서 도는 것은 LOOK입니다.`,
        check: `${scanTurn.path.join(" → ")} = ${legs(scanTurn).join(" + ")} = ${scanTurn.distance}칸. LOOK은 ${scanTurn.before.head}에서 바로 돌아 ${lookTurn.distance}칸입니다.`,
      },
      {
        id: "sweep-longer",
        algorithm: "scan",
        scene: lastScene(scenes, "scan"),
        wrong: "방향을 지키는 SCAN·LOOK은 가까운 요청을 건너뛰므로 SSTF보다 항상 더 움직인다.",
        right:
          "방향을 지켜도 이동이 늘어난다고 단정할 수 없습니다. SCAN 계열의 목적은 기아 방지입니다.",
        check: `같은 입력에서 SCAN ${scan.total}칸은 SSTF ${sstfTotal}칸${versus(scan.total, sstfTotal)}, LOOK ${look.total}칸은 SSTF ${sstfTotal}칸${versusEnd(look.total, sstfTotal)}.`,
      },
      {
        id: "look-starve",
        algorithm: "look",
        scene: lastScene(scenes, "look"),
        wrong: "끝까지 가지 않는 LOOK은 먼 요청을 굶길 수 있다.",
        right: "LOOK도 한 방향을 다 처리한 뒤에만 돌아서므로 먼 요청은 다음 쓸기 안에 처리됩니다.",
        check: `가장 먼 ${eun(`${far}번`)} ${farPos}번째, 대기 ${look.waits[farPos - 1].wait}칸에 처리됐습니다.`,
      },
    ];
  }
  const { cscan } = runs;
  const ret = cscan.steps[turnOf(cscan)];
  const retLegs = legs(ret);
  const back = retLegs[ret.jump!];
  const worst = scan.waits.map((w) => worstWait("scan", w.cylinder, { max: input.max }));
  return [
    {
      id: "ssd",
      algorithm: "scan",
      scene: sceneAt(scenes, "scan", 1),
      wrong: "디스크 스케줄링은 SSD에서도 똑같이 중요하다.",
      right:
        "SSD에는 움직이는 헤드가 없어 탐색 거리가 없습니다. 실린더 순서로 줄 세워 얻는 이득이 거의 없습니다(OSTEP 44).",
      check: `첫 이동 ${first.path.join(" → ")}의 ${first.distance}칸은 헤드 팔이 움직인 거리입니다. 이 레슨이 세는 비용은 모두 이런 기계적 이동입니다.`,
    },
    {
      id: "cscan-return",
      algorithm: "cscan",
      scene: sceneAt(scenes, "cscan", ret.index),
      wrong: "C-SCAN의 복귀 이동(끝 → 반대쪽 끝)은 공짜다.",
      right:
        "복귀도 헤드 팔이 움직인 거리입니다. 이 레슨은 이동에 넣어 셉니다(교재에 따라 빼기도 함).",
      check: `${ret.path.join(" → ")} = ${retLegs.join(" + ")} = ${ret.distance}칸. 복귀 ${back}칸을 빼면 ${ret.distance - back}칸입니다.`,
    },
    {
      id: "cscan-shorter",
      algorithm: "cscan",
      scene: lastScene(scenes, "cscan"),
      wrong: "C-SCAN은 SCAN을 개선한 방식이니 이동 거리도 더 짧다.",
      right: "C-SCAN이 얻는 것은 위치와 무관하게 고른 대기이고, 대가로 복귀 이동이 더해집니다.",
      check: `C-SCAN ${cscan.total}칸, SCAN ${scan.total}칸 — C-SCAN이 ${cscan.total - scan.total}칸 더 움직였습니다.`,
    },
    {
      id: "scan-uniform",
      algorithm: "scan",
      scene: lastScene(scenes, "scan"),
      wrong: "SCAN은 모든 실린더의 요청을 똑같이 공평하게 기다리게 한다.",
      right: "SCAN은 가운데가 유리하고 양 끝이 불리합니다. 위치와 무관하게 고른 것은 C-SCAN입니다.",
      check: `계속 도착할 때 최악 대기는 이 요청 위치들에서 ${Math.min(...worst)}–${Math.max(...worst)}칸으로 다릅니다(C-SCAN은 어디서나 ${worstWait("cscan", 0, { max: input.max })}칸).`,
    },
  ];
}
