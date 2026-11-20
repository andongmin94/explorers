// Lesson 01 · 갱신 유실: one stock row, two transactions, a fixed trace per
// read mode (plain SELECT or SELECT … FOR UPDATE).
export const INITIAL_STOCK = 10;
export const CLIENT_IDS = Object.freeze(["T1", "T2"] as const);

export type ClientId = "T1" | "T2";
export type Mode = "naive" | "locked";
export type ClientStatus = "idle" | "active" | "waiting" | "committed";
export type Action =
  | "initial"
  | "begin"
  | "read"
  | "calculate"
  | "write"
  | "wait"
  | "commit"
  | "resume-read"
  | "resume-write";

export interface ClientState {
  status: ClientStatus;
  localRead: number | null;
  localWrite: number | null;
  lastSql: string | null;
}

export interface State {
  committedStock: number;
  committedVersion: number;
  uncommitted: { client: ClientId; stock: number; version: number } | null;
  rowLock: { owner: ClientId | null; mode: "for-update" | "update" | null; waiting: ClientId[] };
  clients: Record<ClientId, ClientState>;
  completedTransactions: number;
}

export interface TxEvent {
  type: string;
  client: ClientId | null;
  [key: string]: unknown;
}

export interface Step {
  index: number;
  mode: Mode;
  action: Action;
  client: ClientId | null;
  sql: string | null;
  checkpoint: string | null;
  before: State;
  state: State;
  events: TxEvent[];
}

export interface Run {
  mode: Mode;
  steps: Step[];
  stats: {
    initialStock: number;
    expectedStock: number;
    actualStock: number;
    completedTransactions: number;
    lostDecrements: number;
    waits: number;
  };
}

export const SCENARIO = Object.freeze({
  database: "PostgreSQL",
  isolation: "READ COMMITTED",
  rowId: 1,
  initialStock: INITIAL_STOCK,
  expectedStock: 8,
  scope: "하나의 재고 행 · 두 트랜잭션 · 각각 1개 감소 · 앱에서 계산한 숫자를 UPDATE",
});

const readSql = (locked: boolean) =>
  `SELECT stock FROM inventory WHERE id = 1${locked ? " FOR UPDATE" : ""};`;
const writeSql = (value: number | null) => `UPDATE inventory SET stock = ${value} WHERE id = 1;`;
const snapshot = (state: State): State => structuredClone(state);

function initialState(): State {
  return {
    committedStock: INITIAL_STOCK,
    committedVersion: 0,
    uncommitted: null,
    rowLock: { owner: null, mode: null, waiting: [] },
    clients: Object.fromEntries(
      CLIENT_IDS.map((id) => [
        id,
        { status: "idle", localRead: null, localWrite: null, lastSql: null },
      ]),
    ) as Record<ClientId, ClientState>,
    completedTransactions: 0,
  };
}

// A fresh ordinary SELECT sees its own write, otherwise the committed version.
// localRead separately preserves the value previously returned to the application.
export function visibleStockFor(state: State, client: ClientId) {
  return state.uncommitted?.client === client ? state.uncommitted.stock : state.committedStock;
}

type TraceEntry = [Action, ClientId, string?];

const traces: Record<Mode, TraceEntry[]> = {
  naive: [
    ["begin", "T1"],
    ["begin", "T2"],
    ["read", "T1"],
    ["read", "T2", "same-read"],
    ["calculate", "T1"],
    ["write", "T1"],
    ["calculate", "T2"],
    ["wait", "T2", "blocked"],
    ["commit", "T1", "handoff"],
    ["resume-write", "T2"],
    ["commit", "T2", "result"],
  ],
  locked: [
    ["begin", "T1"],
    ["begin", "T2"],
    ["read", "T1"],
    ["wait", "T2", "blocked"],
    ["calculate", "T1"],
    ["write", "T1"],
    ["commit", "T1", "handoff"],
    ["resume-read", "T2"],
    ["calculate", "T2"],
    ["write", "T2"],
    ["commit", "T2", "result"],
  ],
};

export function simulate({ mode = "naive" }: { mode?: Mode } = {}): Run {
  if (!(mode in traces)) throw new RangeError(`Unknown mode: ${mode}`);
  const state = initialState();
  const steps: Step[] = [
    {
      index: 0,
      mode,
      action: "initial",
      client: null,
      sql: null,
      checkpoint: null,
      before: snapshot(state),
      state: snapshot(state),
      events: [],
    },
  ];
  let waits = 0;

  for (const [action, client, checkpoint = null] of traces[mode]) {
    const before = snapshot(state);
    const current = state.clients[client];
    const events: TxEvent[] = [];
    let sql: string | null = null;
    const emit = (type: string, data: Record<string, unknown> = {}) =>
      events.push({ type, client, ...data });
    const acquireLock = (lockMode: "for-update" | "update") => {
      state.rowLock.owner = client;
      state.rowLock.mode = lockMode;
      emit("lock", { lockMode });
    };
    const read = () => {
      sql = readSql(mode === "locked");
      if (mode === "locked") acquireLock("for-update");
      current.localRead = visibleStockFor(state, client);
      emit("read", { value: current.localRead });
    };
    const write = () => {
      sql = writeSql(current.localWrite);
      // UPDATE always locks the row. Non-key stock changes use NO KEY UPDATE
      // unless this transaction already holds the stronger FOR UPDATE lock.
      if (state.rowLock.owner !== client) acquireLock("update");
      state.uncommitted = {
        client,
        stock: current.localWrite!,
        version: state.committedVersion + 1,
      };
      emit("write", { value: current.localWrite });
    };
    const resume = (request: "read" | "write") => {
      current.status = "active";
      state.rowLock.waiting = [];
      emit("resume", { request });
    };

    switch (action) {
      case "begin":
        sql = "BEGIN ISOLATION LEVEL READ COMMITTED;";
        current.status = "active";
        emit("begin");
        break;
      case "read":
        read();
        break;
      case "calculate":
        current.localWrite = current.localRead! - 1;
        emit("calculate", {
          from: current.localRead,
          value: current.localWrite,
        });
        break;
      case "write":
        write();
        break;
      case "wait": {
        const request = mode === "locked" ? "read" : "write";
        sql = request === "read" ? readSql(true) : writeSql(current.localWrite);
        current.status = "waiting";
        state.rowLock.waiting = [client];
        waits += 1;
        emit("wait", { request, blockedBy: state.rowLock.owner });
        break;
      }
      case "commit":
        sql = "COMMIT;";
        state.committedStock = state.uncommitted!.stock;
        state.committedVersion = state.uncommitted!.version;
        state.uncommitted = null;
        current.status = "committed";
        state.completedTransactions += 1;
        emit("commit", { value: state.committedStock });
        state.rowLock.owner = null;
        state.rowLock.mode = null;
        emit("release");
        break;
      case "resume-read":
        resume("read");
        read();
        break;
      case "resume-write":
        resume("write");
        write();
        break;
    }
    if (sql) current.lastSql = sql;
    steps.push({
      index: steps.length,
      mode,
      action,
      client,
      sql,
      checkpoint,
      before,
      state: snapshot(state),
      events,
    });
  }

  return {
    mode,
    steps,
    stats: {
      initialStock: INITIAL_STOCK,
      expectedStock: SCENARIO.expectedStock,
      actualStock: state.committedStock,
      completedTransactions: state.completedTransactions,
      lostDecrements: state.committedStock - SCENARIO.expectedStock,
      waits,
    },
  };
}
