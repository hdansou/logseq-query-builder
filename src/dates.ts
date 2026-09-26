import type { DateValue, OperatorId, RelativeExpr } from "./model";

/**
 * Dates: what the value control accepts, how a relative expression becomes a native query input
 * (so the host re-resolves it on every run), how an absolute date becomes a literal, and the one
 * definition of day-granularity comparison. Only forms verified live (docs/probes.md) appear here.
 */
export type Boundary = "day" | "start" | "end";
export type Granularity = "day" | "ms";
export type Cmp = "=" | "<" | "<=" | ">" | ">=";

const NAMED: Record<string, RelativeExpr> = { today: "today", tomorrow: "tomorrow", yesterday: "yesterday" };

export function parseRelative(text: string): RelativeExpr | null {
  const t = text.trim().toLowerCase();
  if (NAMED[t]) return NAMED[t];
  const m = /^([+-])(\d+)([dwmy])$/.exec(t);
  if (!m) return null;
  return { offset: Number(m[1] + m[2]), unit: m[3] as "d" | "w" | "m" | "y" };
}

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

/** The host input keyword for a relative expression at a boundary. */
export function relativeInput(expr: RelativeExpr, boundary: Boundary): string {
  if (expr === "today") return boundary === "day" ? ":today" : boundary === "start" ? ":start-of-today-ms" : ":end-of-today-ms";
  if (expr === "tomorrow") return boundary === "day" ? ":tomorrow" : `:+1d-${boundary}`;
  if (expr === "yesterday") return boundary === "day" ? ":yesterday" : `:-1d-${boundary}`;
  const base = `:${signed(expr.offset)}${expr.unit}`;
  return boundary === "day" ? base : `${base}-${boundary}`;
}

/** A journal-day int (yyyymmdd) as the literal the comparison needs. */
export function absoluteLiteral(day: number, boundary: Boundary): number {
  if (boundary === "day") return day;
  const y = Math.floor(day / 10000), m = Math.floor((day % 10000) / 100) - 1, d = day % 100;
  return boundary === "start" ? new Date(y, m, d, 0, 0, 0, 0).getTime() : new Date(y, m, d, 23, 59, 59, 999).getTime();
}

export interface Bound { cmp: Cmp; value: DateValue; boundary: Boundary }

/** How each date operator compares, at day granularity, for `date` (ints) and `datetime` (ms). */
export function bounds(op: OperatorId, values: DateValue[], g: Granularity): Bound[] {
  const [a, b] = values;
  const lo: Boundary = g === "day" ? "day" : "start";
  const hi: Boundary = g === "day" ? "day" : "end";
  switch (op) {
    case "eq": return g === "day" ? [{ cmp: "=", value: a, boundary: "day" }] : [{ cmp: ">=", value: a, boundary: "start" }, { cmp: "<=", value: a, boundary: "end" }];
    case "before": return [{ cmp: "<", value: a, boundary: lo }];
    case "on-or-before": return [{ cmp: "<=", value: a, boundary: hi }];
    case "after": return [{ cmp: ">", value: a, boundary: hi }];
    case "on-or-after": return [{ cmp: ">=", value: a, boundary: lo }];
    case "between": return [{ cmp: ">=", value: a, boundary: lo }, { cmp: "<=", value: b, boundary: hi }];
    default: throw new Error(`not a date operator: ${op}`);
  }
}

const UNIT_NAME = { d: "day", w: "week", m: "month", y: "year" };
export function describeRelative(expr: RelativeExpr): string {
  if (typeof expr === "string") return expr;
  const n = Math.abs(expr.offset);
  const unit = UNIT_NAME[expr.unit] + (n === 1 ? "" : "s");
  return expr.offset < 0 ? `${n} ${unit} ago` : `${n} ${unit} from now`;
}
