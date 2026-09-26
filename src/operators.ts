import type { OperatorId, PropertyType } from "./model";

/**
 * THE operator table. Which operators a type offers, how many values each takes, and which value
 * control a type uses, are defined here and nowhere else. Datalog for each operator is in emit.ts,
 * keyed by these ids.
 */
export interface OperatorDef { label: string; arity: 0 | 1 | 2 | "many" }

export const OPERATORS: Record<OperatorId, OperatorDef> = {
  "contains-any": { label: "contains any", arity: "many" },
  "contains-all": { label: "contains all", arity: "many" },
  "not-contains": { label: "does not contain", arity: "many" },
  gt: { label: "greater than", arity: 1 },
  lt: { label: "less than", arity: 1 },
  between: { label: "between", arity: 2 },
  eq: { label: "equals", arity: 1 },
  before: { label: "before", arity: 1 },
  "on-or-before": { label: "on or before", arity: 1 },
  after: { label: "after", arity: 1 },
  "on-or-after": { label: "on or after", arity: 1 },
  empty: { label: "is empty", arity: 0 },
  "not-empty": { label: "is not empty", arity: 0 },
  has: { label: "has", arity: 0 },
  "not-has": { label: "does not have", arity: 0 },
  true: { label: "is true", arity: 0 },
  false: { label: "is false", arity: 0 },
};

const MULTI: OperatorId[] = ["contains-any", "contains-all", "not-contains"];
const EMPTINESS: OperatorId[] = ["empty", "not-empty"];
const PRESENCE: OperatorId[] = ["has", "not-has"];
const DATE: OperatorId[] = ["eq", "before", "on-or-before", "after", "on-or-after", "between"];

const BY_TYPE: Record<PropertyType, OperatorId[]> = {
  default: [...MULTI, ...EMPTINESS, ...PRESENCE],
  node: [...MULTI, ...EMPTINESS, ...PRESENCE],
  url: [...MULTI, ...EMPTINESS, ...PRESENCE],
  number: [...MULTI, "gt", "lt", "between", ...EMPTINESS, ...PRESENCE],
  asset: ["contains-any", "contains-all", ...EMPTINESS, ...PRESENCE],
  date: [...DATE, ...EMPTINESS, ...PRESENCE],
  datetime: [...DATE, ...EMPTINESS, ...PRESENCE],
  checkbox: ["true", "false", ...PRESENCE],
};

export const operatorsFor = (type: PropertyType): OperatorId[] => BY_TYPE[type];
export const arityOf = (op: OperatorId) => OPERATORS[op].arity;

export type ControlKind = "text" | "number" | "node" | "asset" | "date" | "none";
const CONTROL: Record<PropertyType, ControlKind> = {
  default: "text", url: "text", number: "number", node: "node", asset: "asset", date: "date", datetime: "date", checkbox: "none",
};
export const controlFor = (type: PropertyType): ControlKind => CONTROL[type];
