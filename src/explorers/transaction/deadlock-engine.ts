// Lesson 02 · 교착 상태: rows A and B, two transactions that lock them in
// opposite or in the same order.
import type { ClientId } from "./types.ts";

export type Order = "opposite" | "same";
export type RowId = "A" | "B";
export type DeadlockAction =
  | "initial"
  | "begin"
  | "write"
  | "wait"
  | "detect"
  | "rollback"
  | "resume"
  | "commit";
export type DeadlockStatus = "idle" | "active" | "waiting" | "committed" | "aborted";

export interface DeadlockRow {
  committed: number;
  pending: { client: ClientId; value: number } | null;
  owner: ClientId | null;
  waiting: ClientId[];
}
export interface DeadlockClient {
  status: DeadlockStatus;
  waitingFor: RowId | null;
  held: RowId[];
  lastSql: string | null;
}
export interface DeadlockState {
  rows: Record<RowId, DeadlockRow>;
  clients: Record<ClientId, DeadlockClient>;
  deadlocked: boolean;
  detected: boolean;
  victim: ClientId | null;
  commits: number;
  rollbacks: number;
}
export interface DeadlockStep {
  index: number;
  order: Order;
  action: DeadlockAction;
  client: ClientId | null;
  row: RowId | null;
  sql: string | null;
  before: DeadlockState;
  state: DeadlockState;
}
export interface DeadlockRun {
  order: Order;
  steps: DeadlockStep[];
  stats: { commits: number; rollbacks: number; finalStocks: Record<RowId, number> };
}

const CLIENTS: ClientId[] = ["T1", "T2"];
const ROWS: RowId[] = ["A", "B"];
const updateSql = (row: RowId | null) =>
  `UPDATE inventory SET stock = stock - 1 WHERE id = '${row}';`;

function initialState(): DeadlockState {
  return {
    rows: Object.fromEntries(
      ROWS.map((id, i) => [
        id,
        { committed: i ? 20 : 10, pending: null, owner: null, waiting: [] },
      ]),
    ) as unknown as Record<RowId, DeadlockRow>,
    clients: Object.fromEntries(
      CLIENTS.map((id) => [id, { status: "idle", waitingFor: null, held: [], lastSql: null }]),
    ) as unknown as Record<ClientId, DeadlockClient>,
    deadlocked: false,
    detected: false,
    victim: null,
    commits: 0,
    rollbacks: 0,
  };
}

// Two fixed runs on the same rows and the same UPDATEs:
//   opposite: T1 locks A→B, T2 locks B→A: a wait cycle, detection, T2 aborted.
//   same:     both lock A→B: T2 waits on A holding nothing, then proceeds.
// Detection and abort are separate observation points, not measured DB timing.
export const ORDERS: Readonly<Record<Order, string>> = Object.freeze({
  opposite: "반대 순서",
  same: "같은 순서",
});
type TraceEntry = [DeadlockAction, ClientId | null, RowId | null];
const opposite: TraceEntry[] = [
  ["begin", "T1", null],
  ["begin", "T2", null],
  ["write", "T1", "A"],
  ["write", "T2", "B"],
  ["wait", "T1", "B"],
  ["wait", "T2", "A"],
  ["detect", null, null],
  ["rollback", "T2", "B"],
  ["resume", "T1", "B"],
  ["commit", "T1", null],
];
const same: TraceEntry[] = [
  ["begin", "T1", null],
  ["begin", "T2", null],
  ["write", "T1", "A"],
  ["wait", "T2", "A"],
  ["write", "T1", "B"],
  ["commit", "T1", null],
  ["resume", "T2", "A"],
  ["write", "T2", "B"],
  ["commit", "T2", null],
];
const TRACES = { opposite, same };

export function simulateDeadlock({ order = "opposite" }: { order?: Order } = {}): DeadlockRun {
  if (!(order in TRACES)) throw new RangeError(`Unknown order: ${order}`);
  const state = initialState();
  const steps: DeadlockStep[] = [
    {
      index: 0,
      order,
      action: "initial",
      client: null,
      row: null,
      sql: null,
      before: structuredClone(state),
      state: structuredClone(state),
    },
  ];

  for (const [action, client, rowId] of TRACES[order]) {
    const before = structuredClone(state);
    const current = client ? state.clients[client] : null;
    const row = rowId ? state.rows[rowId] : null;
    let sql: string | null = null;

    switch (action) {
      case "begin":
        sql = "BEGIN ISOLATION LEVEL READ COMMITTED;";
        current!.status = "active";
        break;
      case "write":
      case "resume":
        sql = updateSql(rowId);
        row!.owner = client;
        row!.pending = { client: client!, value: row!.committed - 1 };
        row!.waiting = row!.waiting.filter((id) => id !== client);
        current!.status = "active";
        current!.waitingFor = null;
        break;
      case "wait":
        sql = updateSql(rowId);
        row!.waiting.push(client!);
        current!.status = "waiting";
        current!.waitingFor = rowId;
        break;
      case "detect":
        state.detected = true;
        // Fixed only to make this lesson reproducible; PostgreSQL may pick either.
        state.victim = "T2";
        break;
      case "rollback":
        // The database aborts T2. This is not a new client-issued SQL request.
        for (const item of Object.values(state.rows)) {
          if (item.owner === client) {
            item.pending = null;
            item.owner = null;
          }
          item.waiting = item.waiting.filter((id) => id !== client);
        }
        current!.status = "aborted";
        current!.waitingFor = null;
        state.rollbacks += 1;
        break;
      case "commit":
        sql = "COMMIT;";
        for (const item of Object.values(state.rows)) {
          if (item.owner === client) {
            item.committed = item.pending!.value;
            item.pending = null;
            item.owner = null;
          }
        }
        current!.status = "committed";
        state.commits += 1;
        break;
    }

    if (sql) current!.lastSql = sql;
    for (const id of CLIENTS)
      state.clients[id].held = ROWS.filter((key) => state.rows[key].owner === id);
    state.deadlocked = CLIENTS.every((id) => {
      const target = state.clients[id].waitingFor;
      return target !== null && state.rows[target].owner === (id === "T1" ? "T2" : "T1");
    });
    steps.push({
      index: steps.length,
      order,
      action,
      client,
      row: rowId,
      sql,
      before,
      state: structuredClone(state),
    });
  }
  return {
    order,
    steps,
    stats: {
      commits: state.commits,
      rollbacks: state.rollbacks,
      finalStocks: Object.fromEntries(ROWS.map((id) => [id, state.rows[id].committed])) as Record<
        RowId,
        number
      >,
    },
  };
}

export function getDeadlockPresentationState(
  step: DeadlockStep,
  phase: "request" | "database" | "complete",
): DeadlockState {
  if (phase === "request") return step.before;
  if (phase === "complete") return step.state;
  // "database"
  if (step.action !== "commit") return step.state;
  return {
    ...step.state,
    clients: {
      ...step.state.clients,
      [step.client!]: { ...step.state.clients[step.client!], status: "active" },
    },
  };
}
