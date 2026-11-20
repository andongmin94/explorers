// Isolation-level lessons (PostgreSQL, docs 13.2): a small snapshot model of
// two transactions. Each row keeps its committed versions (with the commit
// sequence number that made them), at most one uncommitted write and its row
// lock. The traces list what the clients send; the engine decides from the
// isolation level whether an UPDATE runs, waits, is re-evaluated or fails.
//
//   repeatable-read · rc | rr   one stock row, both run UPDATE … SET stock = stock - 1
//   write-skew      · rr | ser  two on-call doctors both go off call
//
// Rules modelled (PostgreSQL 13.2.1–13.2.3):
// - READ COMMITTED takes a new snapshot for every statement. An UPDATE that
//   waited on a row lock re-checks WHERE and re-evaluates SET on the updated
//   row version once the other transaction commits.
// - REPEATABLE READ and SERIALIZABLE take one snapshot at the first
//   non-transaction-control statement. Updating a row that another
//   transaction changed and committed after that snapshot fails with 40001
//   "could not serialize access due to concurrent update".
// - SERIALIZABLE also tracks read/write dependencies (SSI). Here: at COMMIT,
//   if a concurrent transaction that already committed wrote something this
//   one read AND read something this one wrote, this one fails with 40001
//   "could not serialize access due to read/write dependencies among
//   transactions". (Two-transaction cycle only; a simplification.)
// - A transaction whose statement failed is aborted until ROLLBACK. A failed
//   COMMIT ends the transaction rolled back.

import type { ClientId } from "./types.ts";

export type Level = "rc" | "rr" | "ser";
export type ScenarioId = "repeatable-read" | "write-skew";
/** A row value: a stock count, or a doctor's on_call flag. */
export type Value = number | boolean;
export type IsoAction =
  | "initial"
  | "begin"
  | "select"
  | "decide"
  | "write"
  | "wait"
  | "resume-write"
  | "error"
  | "commit"
  | "commit-error"
  | "rollback";
export type IsoStatus = "idle" | "active" | "waiting" | "aborted" | "rolledback" | "committed";
export interface SqlError {
  code: string;
  message: string;
}
export interface Version {
  value: Value;
  seq: number;
  by: ClientId | null;
}
export interface IsoRow {
  versions: Version[];
  pending: { client: ClientId; value: Value } | null;
  owner: ClientId | null;
  waiting: ClientId[];
}
export interface IsoClient {
  status: IsoStatus;
  level: Level;
  attempt: number;
  snapshot: number | null;
  read: number | null;
  plan: "off" | "stay" | null;
  waitingFor: string | null;
  error: SqlError | null;
  reads: string[];
  writes: string[];
  lastSql: string | null;
}
export interface IsoState {
  seq: number;
  rows: Record<string, IsoRow>;
  clients: Record<ClientId, IsoClient>;
  committed: {
    client: ClientId;
    attempt: number;
    seq: number;
    reads: string[];
    writes: string[];
  }[];
  commits: number;
  errors: number;
}
export interface IsoStep {
  index: number;
  scenario: ScenarioId;
  mode: Level;
  action: IsoAction;
  client: ClientId | null;
  row: string | null;
  sql: string | null;
  error: SqlError | null;
  before: IsoState;
  state: IsoState;
}
export interface IsoRun {
  scenario: ScenarioId;
  mode: Level;
  steps: IsoStep[];
  stats: {
    finals: Record<string, Value>;
    onCall: number;
    commits: number;
    errors: number;
    attempts: Record<ClientId, number>;
  };
}
interface Model {
  table: string;
  rows: Record<string, Value>;
  select: () => string;
  readValue: (visible: (id: string) => Value) => number;
  readRows: string[];
  update: (row?: string | null) => string;
  apply: (value: Value) => Value;
  decide?: (count: number) => "off" | "stay";
}
type TraceKind = "begin" | "select" | "decide" | "update" | "resume" | "commit" | "rollback";
type TraceEntry = [TraceKind, ClientId, string?];

export const LEVELS: Readonly<Record<Level, string>> = Object.freeze({
  rc: "READ COMMITTED",
  rr: "REPEATABLE READ",
  ser: "SERIALIZABLE",
});

export const ERRORS = Object.freeze({
  update: { code: "40001", message: "could not serialize access due to concurrent update" },
  ssi: {
    code: "40001",
    message: "could not serialize access due to read/write dependencies among transactions",
  },
});

const CLIENTS: ClientId[] = ["T1", "T2"];

const stock: Model = {
  table: "inventory",
  rows: { 1: 10 },
  select: () => "SELECT stock FROM inventory WHERE id = 1;",
  readValue: (visible) => visible("1") as number,
  readRows: ["1"],
  update: () => "UPDATE inventory SET stock = stock - 1 WHERE id = 1;",
  apply: (value) => (value as number) - 1,
};

const doctors: Model = {
  table: "doctors",
  rows: { A: true, B: true },
  select: () => "SELECT count(*) FROM doctors WHERE on_call;",
  readValue: (visible) => ["A", "B"].filter((id) => visible(id)).length,
  readRows: ["A", "B"],
  update: (row) => `UPDATE doctors SET on_call = false WHERE name = '${row}';`,
  apply: () => false,
  // The application's rule: leave only if someone else stays on call.
  decide: (count) => (count >= 2 ? "off" : "stay"),
};

const head: TraceEntry[] = [
  ["begin", "T1"],
  ["begin", "T2"],
  ["select", "T1"],
  ["select", "T2"],
];

export const SCENARIOS: Readonly<
  Record<ScenarioId, { model: Model; modes: Level[]; traces: Partial<Record<Level, TraceEntry[]>> }>
> = Object.freeze({
  "repeatable-read": {
    model: stock,
    modes: ["rc", "rr"],
    traces: {
      rc: [
        ...head,
        ["update", "T1", "1"],
        ["update", "T2", "1"],
        ["commit", "T1"],
        ["resume", "T2"],
        ["commit", "T2"],
      ],
      rr: [
        ...head,
        ["update", "T1", "1"],
        ["update", "T2", "1"],
        ["commit", "T1"],
        ["resume", "T2"],
        ["rollback", "T2"],
        ["begin", "T2"],
        ["select", "T2"],
        ["update", "T2", "1"],
        ["commit", "T2"],
      ],
    },
  },
  "write-skew": {
    model: doctors,
    modes: ["rr", "ser"],
    traces: {
      rr: [
        ...head,
        ["decide", "T1"],
        ["decide", "T2"],
        ["update", "T1", "A"],
        ["update", "T2", "B"],
        ["commit", "T1"],
        ["commit", "T2"],
      ],
      ser: [
        ...head,
        ["decide", "T1"],
        ["decide", "T2"],
        ["update", "T1", "A"],
        ["update", "T2", "B"],
        ["commit", "T1"],
        ["commit", "T2"],
        ["begin", "T2"],
        ["select", "T2"],
        ["decide", "T2"],
        ["commit", "T2"],
      ],
    },
  },
});

function initialState(model: Model, level: Level): IsoState {
  return {
    seq: 0,
    rows: Object.fromEntries(
      Object.entries(model.rows).map(([id, value]) => [
        id,
        { versions: [{ value, seq: 0, by: null }], pending: null, owner: null, waiting: [] },
      ]),
    ) as Record<string, IsoRow>,
    clients: Object.fromEntries(
      CLIENTS.map((id) => [
        id,
        {
          status: "idle",
          level,
          attempt: 0,
          snapshot: null,
          read: null,
          plan: null,
          waitingFor: null,
          error: null,
          reads: [],
          writes: [],
          lastSql: null,
        },
      ]),
    ) as unknown as Record<ClientId, IsoClient>,
    committed: [],
    commits: 0,
    errors: 0,
  };
}

/** Latest committed value of a row. */
export const committedValue = (state: IsoState, row: string): Value =>
  state.rows[row].versions.at(-1)!.value;

/**
 * What a statement of `client` sees in `row` now: its own uncommitted write,
 * else the newest version committed up to its snapshot (READ COMMITTED: now).
 */
export function visibleValue(state: IsoState, client: ClientId, row: string): Value {
  const r = state.rows[row];
  if (r.pending?.client === client) return r.pending.value;
  const c = state.clients[client];
  const snap = c.level === "rc" || c.snapshot === null ? state.seq : c.snapshot;
  return r.versions.findLast((v) => v.seq <= snap)!.value;
}

export function simulateIsolation({
  scenario = "repeatable-read",
  mode,
}: { scenario?: ScenarioId; mode?: Level } = {}): IsoRun {
  const spec = SCENARIOS[scenario];
  if (!spec) throw new RangeError(`Unknown scenario: ${scenario}`);
  mode ??= spec.modes[0];
  if (!spec.modes.includes(mode)) throw new RangeError(`Unknown mode for ${scenario}: ${mode}`);
  const { model } = spec;
  const level: Level = mode;
  const state = initialState(model, level);
  const steps: IsoStep[] = [
    {
      index: 0,
      scenario,
      mode,
      action: "initial",
      client: null,
      row: null,
      sql: null,
      error: null,
      before: structuredClone(state),
      state: structuredClone(state),
    },
  ];

  const takeSnapshot = (c: IsoClient) => {
    if (c.level !== "rc" && c.snapshot === null) c.snapshot = state.seq;
  };
  const release = (client: ClientId, keep: boolean) => {
    for (const r of Object.values(state.rows)) {
      if (r.owner !== client) continue;
      if (keep) r.versions.push({ value: r.pending!.value, seq: state.seq, by: client });
      r.pending = null;
      r.owner = null;
    }
  };

  // Run (or re-run after a wait) one UPDATE on a free row: either it writes,
  // or, in REPEATABLE READ/SERIALIZABLE, it fails on a newer committed version.
  function applyUpdate(client: ClientId, row: string): "error" | "write" {
    const c = state.clients[client];
    const r = state.rows[row];
    const latest = r.versions.at(-1)!;
    if (c.level !== "rc" && latest.seq > c.snapshot!) {
      c.status = "aborted";
      c.error = ERRORS.update;
      state.errors += 1;
      return "error";
    }
    // READ COMMITTED: re-evaluated on the newest committed version.
    r.owner = client;
    r.pending = { client, value: model.apply(latest.value) };
    if (!c.writes.includes(row)) c.writes.push(row);
    return "write";
  }

  for (const [kind, client, rowId = null] of spec.traces[mode]!) {
    const before = structuredClone(state);
    const c = state.clients[client];
    let action = kind as IsoAction;
    let row: string | null = rowId;
    let sql: string | null = null;
    let error: SqlError | null = null;
    const expect = (ok: boolean, what: string) => {
      if (!ok) throw new Error(`${scenario}/${mode} step ${steps.length}: ${what}`);
    };

    switch (kind) {
      case "begin":
        expect(
          ["idle", "rolledback"].includes(c.status),
          `${client} cannot BEGIN while ${c.status}`,
        );
        sql = `BEGIN ISOLATION LEVEL ${LEVELS[level]};`;
        Object.assign(c, {
          status: "active",
          attempt: c.attempt + 1,
          snapshot: null,
          read: null,
          plan: null,
          error: null,
          reads: [],
          writes: [],
        });
        break;
      case "select":
        expect(c.status === "active", `${client} SELECT while ${c.status}`);
        sql = model.select();
        takeSnapshot(c);
        c.read = model.readValue((id) => visibleValue(state, client, id));
        for (const id of model.readRows) if (!c.reads.includes(id)) c.reads.push(id);
        break;
      case "decide":
        expect(c.status === "active" && c.read !== null, `${client} decides without a read`);
        c.plan = model.decide!(c.read!);
        break;
      case "update": {
        expect(c.status === "active", `${client} UPDATE while ${c.status}`);
        sql = model.update(row);
        takeSnapshot(c);
        const r = state.rows[row!];
        if (r.owner && r.owner !== client) {
          action = "wait";
          c.status = "waiting";
          c.waitingFor = row;
          r.waiting.push(client);
        } else {
          action = applyUpdate(client, row!);
          error = c.error;
        }
        break;
      }
      case "resume": {
        row = c.waitingFor!;
        expect(c.status === "waiting" && !state.rows[row].owner, `${client} cannot resume`);
        const r = state.rows[row];
        r.waiting = r.waiting.filter((id) => id !== client);
        c.waitingFor = null;
        c.status = "active";
        sql = model.update(row);
        action = applyUpdate(client, row) === "error" ? "error" : "resume-write";
        error = c.error;
        break;
      }
      case "commit": {
        expect(c.status === "active", `${client} COMMIT while ${c.status}`);
        sql = "COMMIT;";
        const cycle =
          c.level === "ser" &&
          state.committed.some(
            (y) =>
              y.client !== client &&
              y.seq > (c.snapshot ?? state.seq) &&
              c.reads.some((id) => y.writes.includes(id)) &&
              y.reads.some((id) => c.writes.includes(id)),
          );
        if (cycle) {
          action = "commit-error";
          release(client, false);
          c.status = "rolledback";
          c.error = error = ERRORS.ssi;
          state.errors += 1;
          break;
        }
        if (c.writes.length) state.seq += 1;
        release(client, true);
        state.committed.push({
          client,
          attempt: c.attempt,
          seq: state.seq,
          reads: [...c.reads],
          writes: [...c.writes],
        });
        c.status = "committed";
        state.commits += 1;
        break;
      }
      case "rollback":
        expect(c.status === "aborted", `${client} ROLLBACK while ${c.status}`);
        sql = "ROLLBACK;";
        release(client, false);
        c.status = "rolledback";
        c.error = null;
        break;
      default:
        throw new RangeError(`Unknown step: ${kind}`);
    }
    if (sql) c.lastSql = sql;
    steps.push({
      index: steps.length,
      scenario,
      mode,
      action,
      client,
      row,
      sql,
      error,
      before,
      state: structuredClone(state),
    });
  }

  const finals = Object.fromEntries(
    Object.keys(state.rows).map((id) => [id, committedValue(state, id)]),
  );
  return {
    scenario,
    mode,
    steps,
    stats: {
      finals,
      onCall: Object.values(finals).filter((v) => v === true).length,
      commits: state.commits,
      errors: state.errors,
      attempts: Object.fromEntries(CLIENTS.map((id) => [id, state.clients[id].attempt])) as Record<
        ClientId,
        number
      >,
    },
  };
}

/**
 * What the scene shows during an event: "request" = before, "complete" =
 * after, "database" = the DB change done while the requester still waits for
 * its response (its status stays as before, except a wait, which is the DB's
 * answer itself).
 */
export function getIsolationPresentationState(
  step: IsoStep,
  phase: "request" | "database" | "complete",
): IsoState {
  if (phase === "request") return step.before;
  if (phase === "complete") return step.state;
  if (step.action === "wait" || !step.client) return step.state;
  return {
    ...step.state,
    clients: {
      ...step.state.clients,
      [step.client]: {
        ...step.state.clients[step.client],
        status: step.action.startsWith("resume")
          ? "active"
          : step.before.clients[step.client].status,
      },
    },
  };
}
