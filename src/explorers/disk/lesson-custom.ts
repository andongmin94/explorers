// 직접 실험: lesson text for any input and any two methods. Every sentence
// is built from the runs, so it stays true whatever the learner typed (the
// head, the range, the queue, the direction). Same rule as the other
// lessons: nothing states a result before the step that produces it.
// Sources: OSTEP 37.5, Silberschatz 10th ed. 11.2.
import { josa } from "@/lib/josa.ts";
import { LABELS, type RecallQuestion } from "@/lib/lesson-kit.ts";
import { passedOver, pick, shortestTotal, worstWait } from "./engine.ts";
import type {
  Algorithm,
  Candidate,
  Direction,
  DiskInput,
  DiskMisconception,
  LessonApi,
  LessonText,
  Milestone,
  Phase,
  PhaseText,
  Prediction,
  Recap,
  Run,
  Step,
} from "./types.ts";

export const ALL_NAMES: Record<Algorithm, string> = {
  fcfs: "FCFS",
  sstf: "SSTF",
  scan: "SCAN",
  look: "LOOK",
  cscan: "C-SCAN",
};
export const ALL_RULE_SHORT: Record<Algorithm, string> = {
  fcfs: "도착 순서",
  sstf: "가까운 순서",
  scan: "끝에서 전환",
  look: "요청에서 전환",
  cscan: "한 방향만",
};
const SWEEPS: Algorithm[] = ["scan", "look", "cscan"];
const isSweep = (alg: Algorithm) => SWEEPS.includes(alg);

/** A particle after a method name as it is read (LOOK = 룩). */
export function nj(name: string, particle: string) {
  const reading = name === "LOOK" ? "룩" : name;
  return name + josa(reading, particle).slice(reading.length);
}
const cyl = (c: number) => `${c}번`;
const eun = (w: string | number) => josa(w, "은/는");
const eul = (w: string | number) => josa(w, "을/를");

const SIDE: Record<Direction, string> = { down: "바깥쪽", up: "안쪽" };
const route = (step: Step) => step.path.join(" → ");
const moveSign = (step: Step) => Math.sign(step.state.head - step.before.head);

/** The step where a sweep runs out of requests on its side (-1: never). */
export const turnOf = (run: Run) =>
  run.steps.findIndex(
    (s) => s.index > 0 && ((s.via?.length ?? 0) > 0 || s.state.direction !== s.before.direction),
  );
const longestOf = (run: Run) =>
  run.steps.slice(1).reduce((a, b) => (b.distance > a.distance ? b : a));

/** The request farthest from the start head (the earliest one on a tie). */
export const farthest = (input: DiskInput) =>
  input.requests.reduce(
    (best, c) => (Math.abs(c - input.head) > Math.abs(best - input.head) ? c : best),
    input.requests[0],
  );

export function customLesson(
  input: DiskInput,
  pair: [Algorithm, Algorithm],
  runs: Record<string, Run>,
): Omit<LessonApi, "waits"> {
  const { head, max, direction: dir, requests } = input;
  const N = requests.length;
  const edge = dir === "down" ? 0 : max;
  const otherEdge = dir === "down" ? max : 0;
  const side = SIDE[dir];
  const toOther = josa(otherEdge, "으로/로");
  const [A, B] = pair;
  const name = (alg: Algorithm) => ALL_NAMES[alg];
  const best = shortestTotal(requests, head);
  const lo = Math.min(head, ...requests);
  const hi = Math.max(head, ...requests);
  const bestRoute = head - lo <= hi - head ? `${head} → ${lo} → ${hi}` : `${head} → ${hi} → ${lo}`;
  const far = farthest(input);
  const farId = requests.indexOf(far) + 1;
  const position = (alg: Algorithm, id: number) =>
    runs[alg].waits.findIndex((w) => w.id === id) + 1;
  const waitOf = (alg: Algorithm, id: number) => runs[alg].waits.find((w) => w.id === id)!.wait;

  const RULES: Record<Algorithm, string> = {
    fcfs: "도착한 순서를 지킵니다. 헤드에서 멀리 있어도 먼저 들어온 요청을 먼저 처리합니다.",
    sstf: "현재 헤드에서 거리가 가장 짧은 요청을 고릅니다. 요청을 마칠 때마다 다시 잽니다.",
    scan: `진행 방향의 요청을 가까운 순서로 처리하고, 그쪽 요청이 없으면 디스크 끝(${edge})까지 간 뒤 방향을 바꿉니다.`,
    look: "진행 방향의 요청을 가까운 순서로 처리하고, 그쪽 요청이 없으면 그 자리에서 방향을 바꿉니다.",
    cscan: `진행 방향으로만 처리합니다. 끝(${edge})에 닿으면 처리 없이 반대쪽 끝(${otherEdge})으로 돌아가 같은 방향으로 다시 쓸어 옵니다. 이 복귀도 이동 칸으로 셉니다.`,
  };

  /* ---------- 핵심 장면 ---------- */
  function milestonesFor(alg: Algorithm): Milestone[] {
    const run = runs[alg];
    const items = new Map<number, { label: string; preview: string }>();
    items.set(0, { label: `시작 · 헤드 ${head}, 요청 ${N}개`, preview: "시작" });
    if (N > 1) {
      const first = run.steps[1];
      items.set(1, { label: `첫 선택 · ${cyl(first.request!.cylinder)}`, preview: "첫 선택" });
      let key: Step | null = null;
      let label = "";
      if (isSweep(alg)) {
        const t = turnOf(run);
        if (t > 1 && t < N) {
          key = run.steps[t];
          label =
            alg === "cscan"
              ? `${route(key)} · 복귀 포함 ${key.distance}칸`
              : alg === "scan" && key.via!.length
                ? `${route(key)} · 끝까지 갔다가 전환 ${key.distance}칸`
                : `${route(key)} · 요청에서 전환 ${key.distance}칸`;
        }
      }
      if (!key) {
        const long = longestOf(run);
        if (long.index > 1 && long.index < N) {
          key = long;
          label = `${route(long)} · 가장 긴 이동 ${long.distance}칸`;
        }
      }
      if (key) items.set(key.index, { label, preview: isSweep(alg) ? "방향의 끝" : "큰 이동" });
    }
    items.set(N, { label: "결과 · 전체 이동 거리", preview: "결과 · 전체 이동 거리" });
    return [...items.entries()].sort((a, b) => a[0] - b[0]).map(([n, m]) => ({ n, ...m }));
  }

  /* ---------- 핵심 ---------- */
  function takeawayAt(alg: Algorithm, index: number): string {
    const run = runs[alg];
    const step = run.steps[index];
    if (index === 0) return `${name(alg)}: ${RULES[alg]}`;
    if (index === N) {
      const same = run.total === best;
      return `${name(alg)} 합계 ${run.total}칸. 이 입력의 최소 이동은 ${best}칸(${bestRoute})${same ? "으로, 이번에는 최소와 같습니다." : `입니다. ${run.total - best}칸을 더 움직였습니다.`}`;
    }
    const c = step.request!.cylinder;
    const passed = passedOver(step);
    if (alg === "fcfs" && passed.length)
      return `${route(step)} 사이의 ${passed.map((r) => r.cylinder).join("·")}번을 지나쳤지만 처리하지 않았습니다. FCFS는 도착 순서만 봅니다.`;
    if (isSweep(alg) && index === turnOf(run)) {
      if (alg === "cscan")
        return `${side}에 요청이 없어 끝 ${edge}에서 반대쪽 끝 ${toOther} 돌아간 뒤 ${eul(cyl(c))} 처리했습니다. 이번 ${step.distance}칸에 복귀가 들어 있습니다.`;
      if (alg === "scan" && step.via!.length)
        return `${side}에 요청이 없어도 끝 ${edge}까지 ${Math.abs(step.before.head - edge)}칸을 더 간 뒤 돌아왔습니다. LOOK이라면 ${step.before.head}에서 바로 돕니다.`;
      return `${step.before.head}에서 바로 방향을 바꿔 ${cyl(c)}까지 ${step.distance}칸. 끝(${edge})까지 가지 않았습니다.`;
    }
    const runnerUp = alg === "sstf" ? step.candidates[1] : undefined;
    if (
      runnerUp &&
      index > 1 &&
      runnerUp.distance - step.distance <= 2 &&
      moveSign(step) !== moveSign(run.steps[index - 1])
    )
      return `${step.distance}칸 대 ${runnerUp.distance}칸, ${runnerUp.distance - step.distance}칸 차이로 방향이 바뀌었습니다. SSTF는 지금 위치만 보고 고릅니다.`;
    const farPending = step.state.pending.some((r) => r.id === farId);
    if (farPending && (alg === "sstf" || isSweep(alg)))
      return `${cyl(c)} 처리(대기 ${step.state.total}칸). 처음 헤드에서 가장 먼 ${eun(cyl(far))} 아직 기다립니다.`;
    return `${cyl(c)} 처리(대기 ${step.state.total}칸). 남은 요청은 ${step.state.pending.length}개입니다.`;
  }

  /* ---------- 해설 ---------- */
  function lessonAt(alg: Algorithm, index: number): LessonText {
    const step = runs[alg].steps[index];
    if (index === 0)
      return {
        eyebrow: LABELS.custom,
        title: `${nj(name(A), "와/과")} ${name(B)}, 어느 쪽이 덜 움직일까?`,
        body: `헤드 ${head}, 실린더 0–${max}, 요청 ${N}개(${requests.join(" · ")}). 헤드는 ${side}(${edge} 쪽)으로 움직이던 중입니다. ${name(alg)}: ${RULES[alg]}`,
        goal: `${LABELS.goal}: 내가 만든 입력에서 두 방식의 처리 순서와 이동 거리를 비교하고, 차이가 어디서 갈리는지 설명한다.`,
      };
    if (index === N)
      return {
        eyebrow: "모두 완료",
        title: `모든 요청 완료 · ${step.state.total}칸`,
        body: `${nj(name(alg), "으로/로")} 요청 ${N}개를 모두 처리했습니다. 마지막은 ${cyl(step.request!.cylinder)}(대기 ${step.state.total}칸)입니다.`,
      };
    const c = step.request!.cylinder;
    let body: string;
    if (alg === "fcfs") {
      const nearer = step.candidates
        .filter((r) => r.id !== step.request!.id)
        .reduce<Candidate | null>((a, b) => (!a || b.distance < a.distance ? b : a), null);
      body = `${eun(`요청 ${step.request!.id}번`)} 남은 요청 중 가장 먼저 도착했습니다.${nearer && nearer.distance < step.distance ? ` 더 가까운 ${cyl(nearer.cylinder)}(${nearer.distance}칸)이 있어도 도착 순서를 따릅니다.` : ""}`;
    } else if (alg === "sstf")
      body = `직전 헤드 ${step.before.head}에서 가장 가까운 요청이 ${cyl(c)}이었습니다. 다음 선택은 새 위치 ${eul(c)} 기준으로 합니다.`;
    else if (index === turnOf(runs[alg]))
      body =
        alg === "cscan"
          ? `${SIDE[step.before.direction]}에 남은 요청이 없어 끝 ${edge}에 닿은 뒤 처리 없이 ${toOther} 돌아갔고, 다시 쓸며 ${eul(cyl(c))} 처리했습니다.`
          : alg === "scan" && step.via!.length
            ? `${SIDE[step.before.direction]}에 남은 요청이 없어 끝(${edge})까지 간 뒤 방향을 바꿔 ${eul(cyl(c))} 처리했습니다.`
            : `${SIDE[step.before.direction]}에 남은 요청이 없어 ${step.before.head}에서 바로 방향을 바꿔 ${eul(cyl(c))} 처리했습니다.`;
    else
      body = `진행 방향(${SIDE[step.state.direction]})에서 가장 가까운 요청이 ${cyl(c)}이었습니다. 다음 선택도 같은 방향에서 먼저 찾습니다.`;
    return { eyebrow: `${index}번째 요청`, title: `${route(step)}, ${step.distance}칸 이동`, body };
  }

  /* ---------- the stage foot and the stage text ---------- */
  function phaseText(kind: Phase, step: Step, alg: Algorithm): PhaseText {
    if (kind === "idle")
      return {
        title: `${name(alg)} · ${ALL_RULE_SHORT[alg]}${isSweep(alg) ? ` · ${side}으로 이동 중` : ""}`,
        body: "",
      };
    const done = `${route(step)} · ${step.distance}칸 이동 완료`;
    if (kind === "done") return { title: done, body: "" };
    const r = step.request!;
    if (kind === "select") {
      const turning = isSweep(alg) && step.index === turnOf(runs[alg]);
      const sideNow = SIDE[step.before.direction];
      return {
        title:
          alg === "fcfs"
            ? `요청 ${r.id}번 · ${r.cylinder}번 실린더 선택`
            : alg === "sstf"
              ? `헤드 ${step.before.head} 기준 · 가장 가까운 ${cyl(r.cylinder)} 선택`
              : `${sideNow} ${turning ? "요청 없음" : "방향"} · ${cyl(r.cylinder)} 선택`,
        body:
          alg === "fcfs"
            ? "OS 스케줄러가 남은 요청 중 먼저 도착한 요청을 큐에서 고릅니다. 가까운 위치인지는 선택 기준이 아닙니다."
            : alg === "sstf"
              ? `OS 스케줄러가 현재 헤드 ${step.before.head}에서 가장 가까운 요청을 고릅니다. 거리는 |${r.cylinder} − ${step.before.head}| = ${Math.abs(r.cylinder - step.before.head)}입니다.`
              : turning
                ? `${sideNow}에 남은 요청이 없습니다. ${RULES[alg]}`
                : `OS 스케줄러가 진행 방향(${sideNow})에서 현재 헤드 ${step.before.head}에 가장 가까운 요청을 고릅니다.`,
      };
    }
    if (kind === "controller")
      return {
        title: `요청 ${r.id}번 → 컨트롤러`,
        body: "컨트롤러는 고른 요청을 받아 실행할 뿐입니다. 요청이 도착하면 헤드를 움직입니다.",
      };
    if (kind === "seek")
      return {
        title: `${route(step)} · ${step.distance}칸 이동 중`,
        body:
          (step.jump ?? -1) >= 0
            ? "끝에서 반대쪽 끝으로 돌아가는 동안에는 요청을 처리하지 않습니다. 이 복귀도 이동 칸으로 셉니다."
            : `선택한 실린더로 헤드를 옮깁니다.${step.via?.length ? ` 도중에 끝(${step.via.join(", ")})을 지납니다.` : ""}`,
      };
    const legs = step.path.slice(1).map((x, i) => Math.abs(x - step.path[i]));
    return {
      title: done,
      body: `${legs.length > 1 ? `${legs.join(" + ")} = ` : `|${r.cylinder} − ${step.before.head}| = `}${step.distance}칸. ${step.before.total} + ${step.distance} = ${step.state.total}칸으로 누적됩니다.`,
    };
  }

  /* ---------- 예측 ---------- */
  // Which cylinder next? The right one, every other method's pick, then the
  // nearest others, up to six choices in cylinder order.
  function predictionFor(alg: Algorithm, index: number): Prediction {
    const step = runs[alg].steps[index];
    const at = step.before.head;
    const d = step.before.direction;
    const pending = step.before.pending.map((r) => ({ ...r, distance: Math.abs(r.cylinder - at) }));
    const right = step.request!;
    const picks = new Map<number, Algorithm[]>();
    for (const m of [...pair, "sstf", "fcfs", "scan", "cscan"] as Algorithm[]) {
      if (m === alg) continue;
      const id = pick(m, step.before.pending, at, d, { max })!.request.id;
      picks.set(id, [...(picks.get(id) ?? []), m]);
    }
    const chosen = new Set([right.id, ...picks.keys()]);
    for (const r of pending.toSorted((x, y) => x.distance - y.distance || x.id - y.id)) {
      if (chosen.size >= 6) break;
      chosen.add(r.id);
    }
    const turning = isSweep(alg) && index === turnOf(runs[alg]);
    const why = (r: Candidate) => {
      if (r.id === right.id) {
        if (alg === "fcfs") return `남은 요청 중 가장 먼저 도착한 요청 ${r.id}번입니다.`;
        if (alg === "sstf") return `헤드 ${at}에서 ${r.distance}칸으로 가장 가깝습니다.`;
        if (!turning)
          return `진행 방향(${SIDE[d]})에서 가장 가까운 요청입니다: |${r.cylinder} − ${at}| = ${r.distance}칸.`;
        if (alg === "cscan")
          return `${SIDE[d]}에 요청이 없어 끝 ${edge}에서 ${toOther} 돌아간 뒤 다시 ${SIDE[d]}으로 쓸어 옵니다. 그 길에서 처음 만나는 요청입니다.`;
        return `${SIDE[d]}에 요청이 없어 방향을 바꾸고, 반대 방향에서 가장 가까운 ${cyl(r.cylinder)}으로 갑니다.`;
      }
      const by = picks.get(r.id);
      if (by)
        return `${by.map(name).join("·")}의 선택입니다. ${name(alg)}: ${ALL_RULE_SHORT[alg]}.`;
      return `${eun(cyl(r.cylinder))} ${r.distance}칸입니다. ${name(alg)}의 규칙으로는 ${cyl(right.cylinder)}이 먼저입니다.`;
    };
    return {
      question: "다음에 어느 실린더로 갈까요?",
      prompt: `헤드 ${at}${isSweep(alg) ? `, 진행 방향 ${SIDE[d]}` : ""}. ${name(alg)}의 규칙(${ALL_RULE_SHORT[alg]})대로 고르세요. 버튼은 실린더 번호 순서입니다.`,
      choices: pending
        .filter((r) => chosen.has(r.id))
        .sort((x, y) => x.cylinder - y.cylinder || x.id - y.id)
        .map((r) => ({
          id: r.id,
          label: String(r.cylinder),
          answer: cyl(r.cylinder),
          correct: r.id === right.id,
          why: why(r),
        })),
    };
  }

  /* ---------- 비교 ---------- */
  const STORY: Record<Algorithm, string> = {
    fcfs: "도착 순서대로 오갑니다.",
    sstf: "매번 현재 위치에서 가장 가까운 요청을 고릅니다.",
    scan: `한 방향으로 쓸고, 끝(${edge})까지 간 뒤 돌아옵니다.`,
    look: "한 방향으로 쓸고, 마지막 요청에서 돌아옵니다.",
    cscan: `한 방향으로만 처리하고 끝에서 ${toOther} 복귀합니다.`,
  };
  const fork = runs[A].steps.findIndex(
    (s, i) => i > 0 && s.request!.id !== runs[B].steps[i].request!.id,
  );
  const forkName = fork === 1 ? "첫" : `${fork}번째`;
  function compareNote() {
    const ta = runs[A].total;
    const tb = runs[B].total;
    const head2 =
      fork < 0
        ? `이 입력에서는 두 방식이 같은 순서로 처리합니다${ta === tb ? "" : `(이동은 ${name(A)} ${ta}칸, ${name(B)} ${tb}칸)`}.`
        : `갈림길은 ${forkName} 선택입니다. ${nj(name(A), "은/는")} ${cyl(runs[A].steps[fork].request!.cylinder)}, ${nj(name(B), "은/는")} ${cyl(runs[B].steps[fork].request!.cylinder)}으로 갑니다.`;
    const tail =
      ta === tb
        ? `합계는 둘 다 ${ta}칸입니다.`
        : `합계는 ${name(A)} ${ta}칸, ${name(B)} ${tb}칸으로 ${nj(name(ta < tb ? A : B), "이/가")} ${Math.abs(ta - tb)}칸 덜 움직입니다.`;
    return `${head2} ${fork < 0 ? "" : tail} 이 입력의 최소 이동은 ${best}칸(${bestRoute})입니다.`.replace(
      /\s+/g,
      " ",
    );
  }

  /* ---------- 정리 ---------- */
  // Two questions answered from this input: the first pick, and which method moved less.
  const firstPicks = (["fcfs", "sstf", "scan", "cscan"] as Algorithm[]).map((m) => ({
    m,
    c: pick(
      m,
      requests.map((cy, i) => ({ id: i + 1, cylinder: cy })),
      head,
      dir,
      { max },
    )!.request.cylinder,
  }));
  function firstQuestion(alg: Algorithm): RecallQuestion {
    const right = runs[alg].steps[1].request!.cylinder;
    const labels = [...new Set([right, ...firstPicks.map((p) => p.c)])];
    for (const c of requests.toSorted((x, y) => Math.abs(x - head) - Math.abs(y - head))) {
      if (labels.length >= 3) break;
      if (!labels.includes(c)) labels.push(c);
    }
    return {
      id: `custom-first-${alg}`,
      question: `헤드 ${head}, ${side}으로 이동 중, 요청(도착 순서) ${requests.join(", ")}. ${nj(name(alg), "이/가")} 처음 처리하는 요청은?`,
      choices: labels
        .toSorted((x, y) => x - y)
        .map((c) => {
          const who = firstPicks.filter((p) => p.c === c && p.m !== alg).map((p) => name(p.m));
          return c === right
            ? { label: String(c), correct: true, why: `${name(alg)}: ${RULES[alg]}` }
            : {
                label: String(c),
                why: who.length
                  ? `${cyl(c)}으로 가는 것은 ${who.join("·")}입니다. ${name(alg)}의 첫 선택은 ${cyl(right)}입니다.`
                  : `${cyl(c)}은 어느 규칙의 첫 선택도 아닙니다. ${name(alg)}의 첫 선택은 ${cyl(right)}입니다.`,
              };
        }),
    };
  }
  const ta = runs[A].total;
  const tb = runs[B].total;
  const lessQuestion: RecallQuestion = {
    id: "custom-less",
    question: `이 입력에서 전체 이동이 더 짧은 방식은?`,
    choices: [A, B]
      .map((m) => ({
        label: name(m),
        correct: runs[m].total < runs[m === A ? B : A].total,
        why: `${name(m)} ${runs[m].total}칸, ${name(m === A ? B : A)} ${runs[m === A ? B : A].total}칸입니다.`,
      }))
      .concat({
        label: "같다",
        correct: ta === tb,
        why:
          ta === tb
            ? `둘 다 ${ta}칸입니다.`
            : `${name(A)} ${ta}칸, ${name(B)} ${tb}칸으로 다릅니다.`,
      }),
  };
  function recapFor(alg: Algorithm): Recap {
    const run = runs[alg];
    const farPos = position(alg, farId);
    return {
      points: [
        `${name(alg)}: ${RULES[alg]} 이 입력에서 ${run.total}칸(최소 ${best}칸).`,
        `처음 헤드에서 가장 먼 ${eun(cyl(far))} ${farPos}번째로 처리됐고 대기는 ${waitOf(alg, farId)}칸이었습니다.`,
        fork < 0
          ? "두 방식이 이 입력에서는 같은 순서였습니다. 갈리는 입력을 직접 찾아보세요."
          : `두 방식은 ${forkName} 선택에서 갈립니다. 결과 비교에서 두 경로를 나란히 보세요.`,
      ],
      recall: [firstQuestion(alg), lessQuestion],
    };
  }

  /* ---------- 오개념 바로잡기 ---------- */
  const misconceptions = customMisconceptions(input, pair, runs, milestonesFor);

  const notes = [
    `직접 입력한 예제: 실린더 0–${max}, 처음 헤드 ${head}, 요청 ${N}개가 모두 시작 전에 도착했습니다. 헤드는 ${side}(${edge} 쪽)으로 움직이던 중이라고 가정합니다.`,
    "이동 거리는 실린더 번호 차이입니다(1칸 = 실린더 1개). 대기 = 시작부터 그 요청을 처리할 때까지 헤드가 움직인 칸 수입니다.",
    `최소 이동 = 가까운 쪽 끝 요청까지 갔다가 반대쪽 끝 요청까지 쓰는 거리(${bestRoute}, ${best}칸)입니다. 어떤 순서도 이보다 짧을 수 없습니다.`,
    `C-SCAN의 복귀(${edge} → ${otherEdge})도 헤드가 움직인 거리로 셉니다. 교재에 따라 빼기도 합니다.`,
    "근거: OSTEP 37.5 Disk Scheduling, Silberschatz 『Operating System Concepts』 10판 11.2 HDD Scheduling.",
    "헤드가 움직이는 HDD 모델입니다. 회전 대기·전송 시간은 계산하지 않습니다.",
  ];

  return {
    algorithms: [A, B],
    names: ALL_NAMES,
    ruleShort: ALL_RULE_SHORT,
    milestonesFor,
    takeawayAt,
    lessonAt,
    phaseText,
    predictionFor,
    compareStory: STORY,
    compareExtra: (alg) =>
      `가장 먼 ${eun(cyl(far))} ${position(alg, farId)}번째, 대기 ${waitOf(alg, farId)}칸.`,
    compareNote,
    recapFor,
    recallTotal: 3,
    notes,
    distanceHint: (alg) =>
      alg === "fcfs"
        ? "FCFS는 거리가 아니라 도착 순서로 선택"
        : alg === "sstf"
          ? "SSTF는 이 거리 중 최솟값을 선택 · 직접 계산한 뒤 맞혀보세요"
          : `${name(alg)}: 진행 방향에서 가장 가까운 요청을 선택 · 그쪽에 없으면 ${alg === "look" ? "그 자리에서 전환" : alg === "scan" ? "끝까지 간 뒤 전환" : "끝에서 반대쪽 끝으로 복귀"}`,
    worstWait:
      pair.includes("scan") && pair.includes("cscan")
        ? (alg, c) => worstWait(alg, c, { max })
        : null,
    misconceptions,
  };
}

/**
 * 오개념 for the methods compared, each checked against this run. A
 * statement is only made when the run shows it; otherwise the check says
 * what this input shows and that another input may differ.
 */
export function customMisconceptions(
  input: DiskInput,
  pair: [Algorithm, Algorithm],
  runs: Record<string, Run>,
  milestonesFor: (alg: Algorithm) => Milestone[],
): DiskMisconception[] {
  const { head, max, requests, direction: dir } = input;
  const N = requests.length;
  const best = shortestTotal(requests, head);
  const edge = dir === "down" ? 0 : max;
  const sceneOf = (alg: Algorithm, n: number) => {
    const k = milestonesFor(alg).findIndex((m) => m.n === n);
    return k < 0 ? undefined : k + 1;
  };
  const lastScene = (alg: Algorithm) => milestonesFor(alg).length;
  const far = farthest(input);
  const farId = requests.indexOf(far) + 1;
  const out: DiskMisconception[] = [];
  for (const alg of pair) {
    const run = runs[alg];
    if (alg === "sstf") {
      out.push({
        id: "custom-sstf-optimal",
        algorithm: alg,
        scene: lastScene(alg),
        wrong: "SSTF는 매번 가장 가까운 요청을 고르므로 전체 이동도 항상 최소다.",
        right:
          "매번의 최선이 전체의 최선은 아닙니다(탐욕적 선택). 더 짧은 순서가 있을 수 있습니다.",
        check:
          run.total > best
            ? `SSTF ${run.total}칸, 이 입력의 최소는 ${best}칸 — ${run.total - best}칸을 더 움직였습니다.`
            : `이번에는 SSTF ${run.total}칸이 최소와 같습니다. 교재 예제(레슨 01)에서는 SSTF 236칸, 최소 208칸이었습니다.`,
      });
      const pos = run.waits.findIndex((w) => w.id === farId) + 1;
      out.push({
        id: "custom-sstf-fair",
        algorithm: alg,
        scene: lastScene(alg),
        wrong: "SSTF도 결국 모든 요청을 금방 처리하니 공정하다.",
        right: "가까운 요청이 계속 들어오면 SSTF는 먼 요청을 끝없이 미룰 수 있습니다(기아).",
        check: `처음 헤드에서 가장 먼 ${josa(`${far}번`, "은/는")} ${N}개 중 ${pos}번째, 대기 ${run.waits[pos - 1].wait}칸에 처리됐습니다.`,
      });
    }
    if (alg === "fcfs") {
      const step = run.steps.slice(1).find((s) => passedOver(s).length);
      if (step)
        out.push({
          id: "custom-fcfs-passing",
          algorithm: alg,
          scene: sceneOf(alg, step.index) ?? lastScene(alg),
          wrong: "FCFS라도 헤드가 지나가는 길의 요청은 함께 처리한다.",
          right:
            "FCFS는 큐 맨 앞의 요청만 보고 갑니다. 지나가는 길의 요청도 자기 차례를 기다립니다.",
          check: `${step.index}번째 이동 ${step.path.join(" → ")}에서 ${passedOver(step)
            .map((r) => r.cylinder)
            .join("·")}번 위를 지났지만 처리하지 않았습니다.`,
        });
    }
    if (alg === "scan") {
      const t = turnOf(run);
      const step = t > 0 ? run.steps[t] : null;
      out.push({
        id: "custom-scan-edge",
        algorithm: alg,
        scene: step ? (sceneOf(alg, step.index) ?? lastScene(alg)) : lastScene(alg),
        wrong: "SCAN은 마지막 요청에서 바로 방향을 바꾼다(LOOK과 같다).",
        right: `SCAN은 그 방향에 요청이 없어도 끝(${edge})까지 간 뒤 돕니다. 마지막 요청에서 도는 것은 LOOK입니다.`,
        check:
          step && step.via!.length
            ? `${step.path.join(" → ")}: 요청이 없는 ${edge}까지 ${Math.abs(step.before.head - edge)}칸을 더 가서 이번 이동이 ${step.distance}칸입니다.`
            : `이 입력에서는 SCAN이 끝(${edge})을 지나지 않았습니다. 끝 쪽에 요청이 있었거나 돌아설 필요가 없었습니다.`,
      });
    }
    if (alg === "look") {
      const pos = run.waits.findIndex((w) => w.id === farId) + 1;
      out.push({
        id: "custom-look-starve",
        algorithm: alg,
        scene: lastScene(alg),
        wrong: "끝까지 가지 않는 LOOK은 먼 요청을 굶길 수 있다.",
        right: "LOOK도 한 방향을 다 처리한 뒤에만 돌아서므로 먼 요청은 다음 쓸기 안에 처리됩니다.",
        check: `처음 헤드에서 가장 먼 ${josa(`${far}번`, "은/는")} ${pos}번째, 대기 ${run.waits[pos - 1].wait}칸에 처리됐습니다.`,
      });
    }
    if (alg === "cscan") {
      const t = turnOf(run);
      const step = t > 0 && (run.steps[t].jump ?? -1) >= 0 ? run.steps[t] : null;
      const legs = step ? step.path.slice(1).map((c, i) => Math.abs(c - step.path[i])) : [];
      out.push({
        id: "custom-cscan-return",
        algorithm: alg,
        scene: step ? (sceneOf(alg, step.index) ?? lastScene(alg)) : lastScene(alg),
        wrong: "C-SCAN의 복귀 이동(끝 → 반대쪽 끝)은 공짜다.",
        right:
          "복귀도 헤드 팔이 실제로 움직이는 거리입니다. 이 탐색기는 복귀를 이동에 넣습니다(교재에 따라 빼기도 합니다).",
        check: step
          ? `${step.path.join(" → ")} = ${legs.join(" + ")} = ${step.distance}칸. 복귀 ${legs[step.jump!]}칸을 빼면 ${step.distance - legs[step.jump!]}칸입니다.`
          : "이 입력에서는 복귀가 없었습니다. 진행 방향에 있는 요청만으로 처리가 끝났기 때문입니다.",
      });
    }
  }
  return out.slice(0, 4);
}
