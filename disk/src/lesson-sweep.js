// Lesson text for the sweep lessons: 02 SCAN vs LOOK, 03 C-SCAN vs SCAN.
// Same rule as lesson.js: nothing here states a result before the step that
// produces it (the start screen, previews of unreached scenes and the 핵심
// note before a turn give the rule, never the move).
// Sources: OSTEP 37.5 (Disk Scheduling), Silberschatz 10th ed. 11.2.
import { josa } from "../../shared/josa.js";
import { MAX_CYLINDER, pick, worstWait } from "./engine.js";

const eun = (w) => josa(w, "은/는");
const eul = (w) => josa(w, "을/를");

export const SWEEP_NAMES = { scan: "SCAN", look: "LOOK", cscan: "C-SCAN" };
export const SWEEP_RULE_SHORT = { scan: "끝에서 전환", look: "요청에서 전환", cscan: "한 방향만" };
const SIDE = { down: "바깥쪽", up: "안쪽" };
const EDGE = { down: 0, up: MAX_CYLINDER };
const otherDir = (d) => (d === "down" ? "up" : "down");

/** The step where the head runs out of requests on its side (the 갈림길). */
export const turnIndex = (run) => run.steps.findIndex((s) => s.index > 0 && (s.via.length > 0 || s.state.direction !== s.before.direction));

const route = (step) => step.path.join(" → ");

export const CSCAN_NOTE =
  "C-SCAN의 복귀(0 → 199)도 헤드가 실제로 움직인 거리이므로 이동 거리와 대기에 199칸으로 넣어 셉니다. 교재 풀이에 따라 복귀를 빼기도 합니다(Silberschatz 판마다 다름). 빼면 이 예제의 합계는 187칸입니다.";

/** One lesson's text, bound to its runs. kind: "scan-look" | "cscan". */
export function sweepLesson(kind, runs) {
  const [a, b] = kind === "scan-look" ? ["scan", "look"] : ["scan", "cscan"];
  const dir = runs.scan.steps[0].state.direction;
  const side = SIDE[dir];
  const edge = EDGE[dir];
  const N = runs.scan.steps.length - 1;
  const turn = { [a]: turnIndex(runs[a]), [b]: turnIndex(runs[b]) };
  const waitOf = (alg, cylinder) => runs[alg].waits.find((w) => w.cylinder === cylinder).wait;
  const spread = (alg) => {
    const w = runs[alg].waits.map((x) => x.wait);
    return [Math.min(...w), Math.max(...w)];
  };
  const lastServed = (alg) => runs[alg].waits[runs[alg].waits.length - 1];
  const worstScan = runs.scan.waits.map((w) => worstWait("scan", w.cylinder));
  const worstRange = [Math.min(...worstScan), Math.max(...worstScan)];
  const cycle = worstWait("cscan", 0);

  const question = kind === "scan-look" ? "끝까지 가야 할까?" : "한 방향으로만 돌면 더 공평할까?";
  const goal =
    kind === "scan-look"
      ? "학습 목표: 한 방향으로 쓰는 스케줄링이 SSTF의 기아를 어떻게 막는지, 끝까지 가는 SCAN과 마지막 요청에서 도는 LOOK의 차이로 설명한다."
      : "학습 목표: C-SCAN의 복귀 이동이 무엇을 대가로 무엇을 얻는지 요청별 대기로 설명한다.";
  const RULES = {
    scan: `진행 방향의 요청을 가까운 순서로 처리하고, 디스크 끝(${edge})에 닿은 뒤 방향을 바꿔 되돌아오며 처리합니다.`,
    look: "진행 방향의 요청을 가까운 순서로 처리하고, 그 방향에 요청이 더 없으면 그 자리에서 방향을 바꿉니다.",
    cscan: `진행 방향으로만 처리합니다. 끝(${edge})에 닿으면 처리 없이 반대쪽 끝(${EDGE[otherDir(dir)]})으로 돌아가 같은 방향으로 다시 쓸어 옵니다.`,
  };

  function milestonesFor(alg) {
    const run = runs[alg];
    const t = run.steps[turn[alg]];
    const turnLabel =
      alg === "cscan"
        ? `${route(t)} · 복귀 포함 ${t.distance}칸`
        : alg === "scan"
          ? `${route(t)} · 끝까지 갔다가 전환 ${t.distance}칸`
          : `${route(t)} · 마지막 요청에서 전환 ${t.distance}칸`;
    return [
      { n: 0, label: `시작 · 헤드 ${run.steps[0].state.head}, ${side}으로 이동 중` },
      { n: 1, label: `첫 선택 · 진행 방향의 ${run.steps[1].request.cylinder}`, preview: "첫 선택" },
      { n: t.index, label: turnLabel, preview: "방향의 끝" },
      { n: N, label: kind === "cscan" ? "결과 · 이동 거리와 요청별 대기" : "결과 · 전체 이동 거리" },
    ].map((m) => ({ ...m, preview: m.preview ?? m.label }));
  }

  function takeawayAt(alg, index) {
    const run = runs[alg];
    const step = run.steps[index];
    const name = SWEEP_NAMES[alg];
    if (index === 0) {
      if (kind === "scan-look")
        return alg === "scan"
          ? `SCAN은 ${side} 요청을 차례로 처리하고, 디스크 끝(${edge})에 닿은 뒤에야 방향을 바꿉니다.`
          : `LOOK은 SCAN처럼 한 방향으로 쓸지만, 그 방향에 요청이 더 없으면 그 자리에서 방향을 바꿉니다.`;
      return alg === "scan"
        ? `SCAN은 끝(${edge})에 닿으면 방향을 바꿔 되돌아오며 처리합니다. 요청마다 처리될 때까지 헤드가 움직인 칸을 '대기'로 셉니다.`
        : `C-SCAN은 ${side}으로만 처리합니다. 끝에 닿으면 처리 없이 반대쪽 끝으로 돌아가며, 이 복귀도 이동 칸으로 셉니다.`;
    }
    const c = step.request.cylinder;
    const w = step.state.total;
    if (index === N) {
      if (kind === "scan-look")
        return alg === "scan"
          ? `SCAN 합계 ${w}칸. 요청이 없는 끝까지 다녀온 구간이 LOOK과의 차이입니다.`
          : `LOOK 합계 ${w}칸. 끝에 요청이 없으면 거기까지 갈 필요가 없습니다.`;
      const [lo, hi] = spread(alg);
      return alg === "scan"
        ? `SCAN 합계 ${w}칸. 요청별 대기는 ${lo}칸부터 ${hi}칸(${c}번)까지입니다.`
        : `C-SCAN 합계 ${w}칸(복귀 199칸 포함). 대기는 ${lo}칸부터 ${hi}칸(${c}번)까지. 이 한 묶음만 보면 SCAN보다 길고 고르지도 않습니다.`;
    }
    if (index === 1) {
      const sstf = pick("sstf", step.before.pending, step.before.head, dir).request;
      return sstf.cylinder !== c
        ? `가장 가까운 것은 ${sstf.cylinder}번(${Math.abs(sstf.cylinder - step.before.head)}칸)이지만 진행 방향인 ${side}의 ${c}번(${step.distance}칸)을 먼저 처리합니다. SSTF와 갈리는 지점입니다.`
        : `진행 방향의 가장 가까운 ${c}번을 처리했습니다.`;
    }
    if (index === turn[alg]) {
      if (alg === "look") return `${step.before.head}에서 바로 방향을 바꿔 ${c}번까지 ${step.distance}칸. SCAN이라면 끝(${edge})까지 다녀옵니다.`;
      if (alg === "scan")
        return kind === "scan-look"
          ? `요청이 없는 ${edge}까지 ${Math.abs(step.before.head - edge)}칸을 더 간 뒤 돌아와 ${c}번까지 ${step.distance}칸. LOOK이라면 ${step.before.head}에서 바로 돕니다.`
          : `${edge}에서 돌아 ${c}번까지 ${step.distance}칸(대기 ${w}칸). 돌아선 직후의 구간 ${edge}–${run.steps[0].state.head}은 방금 지나온 곳이라 처리할 요청이 없습니다.`;
      return `${edge}에서 반대쪽 끝 199로 복귀(199칸)한 뒤 ${c}번까지, 모두 ${step.distance}칸. ${c}번의 대기는 ${w}칸입니다.`;
    }
    const left = step.state.pending;
    if (kind === "scan-look") {
      if (index === turn[alg] - 1) return `${side}에 남은 마지막 요청 ${c}번을 처리했습니다. 이제 ${side}에는 요청이 없습니다.`;
      if (left.length === 1)
        return `남은 요청은 가장 먼 ${left[0].cylinder}번 하나입니다. 이번 쓸기 방향에 있으므로, 가까운 곳에 새 요청이 와도 이번 쓸기가 끝나기 전에 닿습니다.`;
      if (index === turn[alg] + 1) return `${c}번 처리. 이제 ${SIDE[otherDir(dir)]}으로 쓸며 지나가는 요청을 차례로 처리합니다. 되돌아가는 일은 없습니다.`;
      if (left.some((r) => r.cylinder === 183))
        return `${c}번 처리. 가장 먼 183번이 남아 있지만 이번 쓸기 방향에 있어 차례가 보장됩니다. SSTF처럼 계속 밀리지 않습니다.`;
      return `${c}번 처리. 한 방향 쓸기에서는 큰 왕복이 한 번뿐입니다.`;
    }
    if (index === turn[alg] - 1) return `${side}의 마지막 요청 ${c}번(대기 ${w}칸). 남은 ${left.length}개는 모두 처음 헤드보다 ${SIDE[otherDir(dir)]}에 있습니다.`;
    if (alg === "cscan") {
      if (index === turn[alg] + 1)
        return `${c}번(대기 ${w}칸). 199 쪽은 헤드가 오래 들르지 않은 구간입니다. 요청이 계속 들어온다면 오래 기다린 요청이 이쪽에 몰려 있습니다.`;
      if (left.length === 1)
        return `${c}번(대기 ${w}칸). 남은 ${left[0].cylinder}번은 처음 헤드에서 ${Math.abs(left[0].cylinder - run.steps[0].state.head)}칸 거리였지만 한 바퀴를 기다립니다.`;
      return `${c}번(대기 ${w}칸). ${side}으로 쓸어 오며 처음 헤드 쪽으로 다가갑니다.`;
    }
    if (left.length === 1) return `${c}번(대기 ${w}칸). 남은 ${left[0].cylinder}번은 안쪽 끝에 가까워 가장 늦습니다.`;
    return `${c}번(대기 ${w}칸). 되돌아오며 처리할수록 대기가 길어집니다.`;
  }

  function lessonAt(alg, index) {
    const run = runs[alg];
    const step = run.steps[index];
    const state = step.state;
    if (index === 0)
      return {
        eyebrow: `레슨 ${kind === "scan-look" ? "02" : "03"}`,
        title: question,
        body:
          kind === "scan-look"
            ? `헤드 ${state.head}, 요청 8개는 01 레슨과 같습니다. 이번에는 헤드가 ${side}(${edge} 쪽)으로 움직이던 중입니다. 엘리베이터처럼 한 방향의 요청을 처리한 뒤 방향을 바꿉니다. ${SWEEP_NAMES[alg]}: ${RULES[alg]}`
            : `헤드 ${state.head}, 같은 요청 8개, ${side}(${edge} 쪽)으로 이동 중입니다. ${SWEEP_NAMES[alg]}: ${RULES[alg]} 대기 = 시작부터 그 요청을 처리할 때까지 헤드가 움직인 칸.`,
        goal,
      };
    if (index === N)
      return {
        eyebrow: "모두 완료",
        title: `모든 요청 완료 · ${state.total}칸`,
        body: `${SWEEP_NAMES[alg]}으로 8개 요청을 모두 처리했습니다. 마지막은 ${lastServed(alg).cylinder}번(대기 ${lastServed(alg).wait}칸)입니다.`,
      };
    const c = step.request.cylinder;
    let body;
    if (index === turn[alg]) {
      if (alg === "cscan")
        body = `${side}에 남은 요청이 없어 끝 ${edge}에 닿은 뒤 처리 없이 199로 돌아갔고, 다시 ${side}으로 쓸며 ${eul(`${c}번`)} 처리했습니다.`;
      else if (alg === "scan") body = `${side}에 남은 요청이 없어 끝(${edge})까지 간 뒤 방향을 바꿔 가장 가까운 ${eul(`${c}번`)} 처리했습니다.`;
      else body = `${side}에 남은 요청이 없어 ${step.before.head}에서 바로 방향을 바꿔 가장 가까운 ${eul(`${c}번`)} 처리했습니다.`;
    } else body = `진행 방향(${SIDE[step.state.direction]})에서 가장 가까운 요청이 ${c}번이었습니다. 다음 선택도 같은 방향에서 먼저 찾습니다.`;
    return { eyebrow: `${index}번째 요청`, title: `${route(step)}, ${step.distance}칸 이동`, body };
  }

  function phaseText(kind2, step, alg) {
    const name = SWEEP_NAMES[alg];
    if (kind2 === "idle") return { title: `${name} · ${SWEEP_RULE_SHORT[alg]} · ${side}으로 이동 중`, body: "" };
    const done = `${route(step)} · ${step.distance}칸 이동 완료`;
    if (kind2 === "done") return { title: done, body: "" };
    const r = step.request;
    const turning = step.index === turn[alg];
    if (kind2 === "select")
      return {
        title: turning ? `${SIDE[step.before.direction]} 요청 없음 · ${r.cylinder}번 선택` : `${SIDE[step.before.direction]} 방향 · ${r.cylinder}번 선택`,
        body: turning
          ? alg === "cscan"
            ? `${SIDE[step.before.direction]}에 남은 요청이 없습니다. C-SCAN은 끝까지 간 뒤 반대쪽 끝으로 돌아가 같은 방향으로 다시 쓸어 옵니다.`
            : alg === "scan"
              ? `${SIDE[step.before.direction]}에 남은 요청이 없습니다. SCAN은 끝(${edge})까지 간 뒤 방향을 바꿉니다.`
              : `${SIDE[step.before.direction]}에 남은 요청이 없습니다. LOOK은 이 자리에서 방향을 바꿉니다.`
          : `OS 스케줄러가 진행 방향(${SIDE[step.before.direction]})에서 현재 헤드 ${step.before.head}에 가장 가까운 요청을 고릅니다.`,
      };
    if (kind2 === "controller")
      return { title: `요청 ${r.id}번 → 컨트롤러`, body: "컨트롤러는 고른 요청을 받아 실행할 뿐입니다. 요청이 도착하면 헤드를 움직입니다." };
    if (kind2 === "seek")
      return {
        title: `${route(step)} · ${step.distance}칸 이동 중`,
        body: step.jump >= 0 ? "끝에서 반대쪽 끝으로 돌아가는 동안에는 요청을 처리하지 않습니다. 이 복귀도 이동 칸으로 셉니다." : `선택한 실린더로 헤드를 옮깁니다.${step.via.length ? ` 도중에 끝(${step.via.join(", ")})을 지납니다.` : ""}`,
      };
    const legs = step.path.slice(1).map((x, i) => Math.abs(x - step.path[i]));
    return {
      title: done,
      body: `${legs.length > 1 ? `${legs.join(" + ")} = ` : `|${r.cylinder} − ${step.before.head}| = `}${step.distance}칸. ${step.before.total} + ${step.distance} = ${step.state.total}칸으로 누적됩니다.`,
    };
  }

  // Why each cylinder would be picked: the method of this lesson, the other
  // method, SSTF (nearest regardless of direction) and FCFS (first arrival).
  function cylinderPrediction(alg, index) {
    const run = runs[alg];
    const step = run.steps[index];
    const head = step.before.head;
    const d = step.before.direction;
    const pending = step.before.pending.map((r) => ({ ...r, distance: Math.abs(r.cylinder - head) }));
    const other = alg === a ? b : a;
    const picks = {
      other: pick(other, step.before.pending, head, d).request.id,
      sstf: pick("sstf", step.before.pending, head, d).request.id,
      fcfs: pick("fcfs", step.before.pending, head, d).request.id,
    };
    const right = step.request;
    const turning = index === turn[alg];
    const inDir = (r) => (r.cylinder - head) * (d === "up" ? 1 : -1) >= 0;
    const why = (r) => {
      if (r.id === right.id) {
        if (!turning) return `진행 방향(${SIDE[d]})에서 가장 가까운 요청입니다: |${r.cylinder} − ${head}| = ${r.distance}칸.`;
        if (alg === "cscan") return `${SIDE[d]}에 요청이 없어 끝 ${edge}에서 199로 돌아간 뒤 다시 ${SIDE[d]}으로 쓸어 옵니다. 그 길에서 처음 만나는 요청이 ${r.cylinder}번입니다.`;
        return `${SIDE[d]}에 요청이 없어 방향을 바꾸고, 반대 방향에서 가장 가까운 ${r.cylinder}번으로 갑니다.`;
      }
      if (r.id === picks.other)
        return other === "cscan"
          ? `${r.cylinder}번으로 가는 것은 C-SCAN입니다. ${SWEEP_NAMES[alg]}은 끝에서 방향을 바꿔 되돌아오며 처리합니다.`
          : turning && alg === "cscan"
            ? `방향을 바꿔 ${r.cylinder}번으로 되돌아오는 것은 SCAN입니다. C-SCAN은 돌아가는 동안 처리하지 않고 반대쪽 끝부터 다시 쓸어 옵니다.`
            : `${r.cylinder}번은 ${SWEEP_NAMES[other]}의 선택입니다.`;
      if (r.id === picks.sstf)
        return `방향과 상관없이 가장 가까운 ${r.cylinder}번(${r.distance}칸)을 고르는 것은 SSTF입니다. ${SWEEP_NAMES[alg]}은 진행 방향을 먼저 봅니다.`;
      if (r.id === picks.fcfs) return `먼저 도착한 요청을 고르는 것은 FCFS입니다. ${eun(`${r.cylinder}번`)} 거리도 방향도 이번 차례가 아닙니다.`;
      if (!turning && inDir(r)) return `${r.cylinder}번도 진행 방향에 있지만 ${r.distance}칸입니다. ${right.cylinder}번이 더 가깝습니다.`;
      if (!turning) return `${eun(`${r.cylinder}번`)} 반대 방향입니다. 진행 방향에 요청이 남아 있는 동안은 돌아서지 않습니다.`;
      if (alg === "cscan") return `${r.cylinder}번도 199에서 다시 쓸어 올 때 지나지만 ${right.cylinder}번보다 나중입니다.`;
      return `${eun(`${r.cylinder}번`)} 방향을 바꾼 뒤에도 ${right.cylinder}번보다 나중에 지납니다.`;
    };
    return {
      question: "다음에 어느 실린더로 갈까요?",
      prompt: `헤드 ${head}, 진행 방향 ${SIDE[d]}(${EDGE[d]} 쪽). ${SWEEP_NAMES[alg]}의 규칙대로 다음 요청을 고르세요. 버튼은 실린더 번호 순서입니다.`,
      choices: pending
        .slice()
        .sort((x, y) => x.cylinder - y.cylinder || x.id - y.id)
        .map((r) => ({ id: r.id, label: String(r.cylinder), answer: `${r.cylinder}번`, correct: r.id === right.id, why: why(r) })),
    };
  }

  // SCAN vs LOOK at the turn: how far is this move?
  function turnPrediction(alg, index) {
    const step = runs[alg].steps[index];
    const head = step.before.head;
    const c = step.request.cylinder;
    const viaEdge = Math.abs(head - edge) + Math.abs(c - edge);
    const direct = Math.abs(c - head);
    const toEdge = Math.abs(head - edge);
    const choices = [
      {
        id: toEdge,
        label: `${toEdge}칸`,
        correct: false,
        why: `${toEdge}칸은 ${head}에서 끝 ${edge}까지만 잰 거리입니다. 이번 이동은 ${c}번에 도착해야 끝납니다.`,
      },
      {
        id: direct,
        label: `${direct}칸`,
        correct: alg === "look",
        why:
          alg === "look"
            ? `LOOK은 ${head}에서 바로 돌아 ${c}번으로 갑니다: |${c} − ${head}| = ${direct}칸.`
            : `${head}에서 바로 도는 것은 LOOK입니다. SCAN은 요청이 없어도 끝 ${edge}까지 갑니다.`,
      },
      {
        id: viaEdge,
        label: `${viaEdge}칸`,
        correct: alg === "scan",
        why:
          alg === "scan"
            ? `SCAN은 끝 ${edge}까지 간 뒤 돌아옵니다: ${toEdge} + ${c} = ${viaEdge}칸.`
            : `끝 ${edge}까지 다녀오는 것은 SCAN입니다(${toEdge} + ${c} = ${viaEdge}칸). LOOK은 마지막 요청에서 돕니다.`,
      },
    ].map((x) => ({ ...x, answer: x.label }));
    return {
      question: `${SWEEP_NAMES[alg]}의 이번 이동은 몇 칸일까요?`,
      prompt: `헤드 ${head}, 진행 방향 ${SIDE[step.before.direction]}(${edge} 쪽)인데 그쪽에는 남은 요청이 없습니다. 남은 요청 중 가장 가까운 것은 ${c}번입니다.`,
      choices,
    };
  }

  function predictionFor(alg, index) {
    if (kind === "scan-look" && index === turn[alg]) return turnPrediction(alg, index);
    return cylinderPrediction(alg, index);
  }

  const COMPARE_STORY =
    kind === "scan-look"
      ? {
          scan: `요청이 없어도 끝 ${edge}까지 쓴 뒤 돌아옵니다.`,
          look: "마지막 요청에서 바로 돌아 빈 구간을 건너뜁니다.",
        }
      : {
          scan: "끝에서 되돌아오며 처리합니다. 돌아선 직후 구간은 방금 지나온 곳이라 비어 있습니다.",
          cscan: `끝에서 처리 없이 199로 돌아가(199칸) 같은 방향으로 다시 쓸어 옵니다.`,
        };

  function compareExtra(alg) {
    if (kind === "scan-look") return `183번은 ${runs[alg].order.indexOf(183) + 1}번째, 대기 ${waitOf(alg, 183)}칸.`;
    const [lo, hi] = spread(alg);
    return alg === "scan"
      ? `이번 묶음의 대기 ${lo}–${hi}칸. 계속 도착하면 최악 대기는 위치에 따라 ${worstRange[0]}–${worstRange[1]}칸.`
      : `이번 묶음의 대기 ${lo}–${hi}칸. 계속 도착하면 최악 대기는 어느 위치든 ${cycle}칸.`;
  }

  function compareNote() {
    if (kind === "scan-look") {
      const s = runs.scan.steps[turn.scan];
      const l = runs.look.steps[turn.look];
      return `갈림길은 ${s.before.head}번 다음입니다. SCAN은 요청이 없는 ${edge}까지 갔다 돌아오고(${s.distance}칸), LOOK은 ${s.before.head}에서 바로 돕니다(${l.distance}칸). 차이 ${runs.scan.total - runs.look.total}칸 = ${s.before.head} → ${edge} → ${s.before.head}. 둘 다 한 방향으로 쓸어서 먼 183번도 이번 쓸기 안에 처리됩니다. SSTF처럼 가까운 요청에 계속 밀리지 않습니다(OSTEP 37.5, Silberschatz 11.2).`;
    }
    const t = runs.cscan.steps[turn.cscan];
    return `갈림길은 ${t.before.head}번 다음입니다. SCAN은 ${edge}에서 돌아 ${runs.scan.steps[turn.scan].request.cylinder}번으로, C-SCAN은 199로 복귀해 ${t.request.cylinder}번으로 갑니다. 복귀 199칸을 세므로 한 묶음에서는 C-SCAN이 ${runs.cscan.total - runs.scan.total}칸 더 움직입니다. 대신 요청이 계속 들어오면 SCAN은 가운데가 유리하고(최악 ${worstRange[0]}칸) 끝이 불리하지만(${worstRange[1]}칸), C-SCAN은 어느 위치든 한 바퀴 ${cycle}칸으로 같습니다(Silberschatz 11.2: 더 고른 대기).`;
  }

  const RECALL =
    kind === "scan-look"
      ? [
          {
            id: "look-why",
            question: "LOOK이 SCAN보다 덜 움직이는 이유는?",
            answer: "끝에 요청이 없으면 거기까지 가지 않아서",
            choices: [
              { label: "가장 가까운 요청을 먼저 골라서", why: "그것은 SSTF입니다. LOOK도 SCAN처럼 진행 방향을 먼저 봅니다." },
              { label: "끝에 요청이 없으면 거기까지 가지 않아서", correct: true, why: "마지막 요청에서 바로 돕니다. 이 예제에서 14 → 0 → 14, 28칸을 아꼈습니다." },
              { label: "방향을 한 번도 바꾸지 않아서", why: "LOOK도 방향을 바꿉니다. 한 방향으로만 처리하는 것은 C-SCAN(C-LOOK)입니다." },
            ],
          },
          {
            id: "scan-total",
            question: "헤드 50, 바깥쪽(0 쪽)으로 이동 중, 요청 30과 80. 실린더 0–199. SCAN의 총 이동은?",
            choices: [
              { label: "70칸", why: "30에서 바로 돌아 80으로 가는 것은 LOOK입니다(20 + 50). SCAN은 끝 0까지 갑니다." },
              { label: "130칸", correct: true, why: "50 → 30 → 0 → 80: 20 + 30 + 80 = 130칸." },
              { label: "249칸", why: "마지막 요청 80을 처리하면 끝납니다. 처리할 요청이 없는 반대쪽 끝 199까지 가지 않습니다." },
            ],
          },
        ]
      : [
          {
            id: "cscan-edge",
            question: "C-SCAN의 헤드가 진행 방향의 끝에 닿으면?",
            answer: "처리 없이 반대쪽 끝으로 돌아가 같은 방향으로 다시 쓴다",
            choices: [
              { label: "방향을 바꿔 되돌아오며 처리한다", why: "그것은 SCAN입니다. C-SCAN은 돌아가는 동안 요청을 처리하지 않습니다." },
              { label: "처리 없이 반대쪽 끝으로 돌아가 같은 방향으로 다시 쓴다", correct: true, why: "그래서 원형(circular) SCAN입니다. 이 레슨은 그 복귀 199칸을 이동에 넣어 셉니다." },
              { label: "가장 가까운 요청으로 간다", why: "방향과 상관없이 가장 가까운 요청을 고르는 것은 SSTF입니다." },
            ],
          },
          {
            id: "cscan-uniform",
            question: "요청이 계속 들어올 때 C-SCAN의 대기가 '고르다'는 뜻은?",
            answer: "어느 위치든 최악 대기가 한 바퀴로 같다",
            choices: [
              { label: "어느 위치든 최악 대기가 한 바퀴로 같다", correct: true, why: `헤드가 지나간 직후 도착한 요청은 위치와 상관없이 한 바퀴(${cycle}칸)를 기다립니다.` },
              { label: "모든 요청의 대기가 SCAN보다 짧다", why: `아닙니다. 이 레슨의 묶음에서도 C-SCAN은 ${runs.cscan.total}칸, SCAN은 ${runs.scan.total}칸이었습니다. 고른 것과 짧은 것은 다릅니다.` },
              { label: "가운데 실린더가 가장 빨리 처리된다", why: `그것은 SCAN의 치우침입니다. SCAN은 가운데 최악 ${worstRange[0]}칸, 끝 쪽은 ${worstRange[1]}칸까지 기다립니다.` },
            ],
          },
        ];

  function recapFor(alg) {
    if (kind === "scan-look")
      return {
        points: [
          "SCAN·LOOK은 한 방향의 요청을 모두 처리한 뒤 방향을 바꿉니다(엘리베이터). 가까운 요청이 계속 와도 먼 요청은 이번 쓸기 안에 차례가 옵니다.",
          `SCAN은 끝(${edge})까지 가서 ${runs.scan.total}칸, LOOK은 마지막 요청에서 돌아 ${runs.look.total}칸. 차이 ${runs.scan.total - runs.look.total}칸은 요청 없는 구간을 다녀온 거리입니다.`,
          `SSTF(236칸)와 SCAN의 합계가 같아도 다른 점은 차례입니다. 다음 요청을 거리만이 아니라 방향으로 정해 기아를 막습니다.`,
        ],
        recall: RECALL,
      };
    return {
      points: [
        `C-SCAN은 한 방향으로만 처리하고, 끝에 닿으면 처리 없이 반대쪽 끝으로 돌아갑니다. 복귀 199칸을 세면 ${runs.cscan.total}칸(SCAN ${runs.scan.total}칸).`,
        `한 묶음에서는 C-SCAN이 더 깁니다. 처음 헤드 옆의 ${lastServed("cscan").cylinder}번이 ${lastServed("cscan").wait}칸을 기다렸습니다. 고른 대기는 요청이 계속 들어올 때 드러납니다.`,
        `계속 도착하면 SCAN의 최악 대기는 위치에 따라 ${worstRange[0]}–${worstRange[1]}칸, C-SCAN은 어느 위치든 ${cycle}칸입니다. 실제 드라이브에서 한 번의 긴 복귀는 칸 수에 비례하는 것보다 빠릅니다.`,
      ],
      recall: RECALL,
    };
  }

  const NOTES = [
    `실린더 0–199, 처음 헤드 53, 요청 8개(01 레슨과 같음)가 모두 시작 전에 도착한 고정 예제입니다. 헤드는 ${side}(${edge} 쪽)으로 움직이던 중이라고 가정합니다.`,
    "이동 거리는 실린더 번호 차이입니다(1칸 = 실린더 1개). OS가 요청 하나를 마칠 때마다 다음 요청을 골라 보낸다고 가정합니다.",
    ...(kind === "cscan"
      ? [
          "대기 = 시작부터 그 요청을 처리할 때까지 헤드가 움직인 칸 수입니다. 헤드가 1칸 움직이는 데 같은 시간이 든다고 가정합니다.",
          CSCAN_NOTE,
          "최악 대기: 요청이 계속 들어오고, 어떤 요청이 헤드가 막 지나간 직후 도착했을 때 다시 그 자리에 올 때까지의 칸 수입니다. SCAN 2 × max(c, 199 − c), C-SCAN 199 + 199(복귀).",
        ]
      : ["SCAN은 디스크 끝까지, LOOK은 마지막 요청까지 갑니다. 두 방식 모두 방향을 바꾸기 전 진행 방향의 요청을 모두 처리합니다."]),
    "근거: OSTEP 37.5 Disk Scheduling (SSTF, Elevator: SCAN·C-SCAN), Silberschatz 『Operating System Concepts』 10판 11.2 HDD Scheduling.",
    "헤드가 움직이는 HDD 모델입니다. 회전 대기·전송 시간은 계산하지 않고, 팔의 움직임은 위치 관계를 보여 주는 투영도입니다.",
  ];

  return {
    algorithms: [a, b],
    names: SWEEP_NAMES,
    ruleShort: SWEEP_RULE_SHORT,
    milestonesFor,
    takeawayAt,
    lessonAt,
    phaseText,
    predictionFor,
    compareStory: COMPARE_STORY,
    compareExtra,
    compareNote,
    recapFor,
    recallTotal: RECALL.length,
    notes: NOTES,
    distanceHint: (alg) =>
      alg === "look"
        ? "LOOK은 진행 방향에서 가장 가까운 요청을 선택 · 그쪽에 없으면 그 자리에서 전환"
        : alg === "scan"
          ? "SCAN은 진행 방향에서 가장 가까운 요청을 선택 · 그쪽에 없으면 끝까지 간 뒤 전환"
          : "C-SCAN은 진행 방향에서 가장 가까운 요청을 선택 · 그쪽에 없으면 끝에서 반대쪽 끝으로 복귀",
    worstWait: kind === "cscan" ? (alg, c) => worstWait(alg, c) : null,
  };
}
