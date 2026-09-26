import { describeRelative } from "./dates";
import { refComplete, rowComplete } from "./guard";
import type { ContentClause, FilterRow, OperatorId, Query, RefRow, RefTarget, TagClause, Value } from "./model";

/** The plain-English line above the results, so a query can be checked without reading Datalog. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function valueText(v: Value): string {
  switch (v.kind) {
    case "text": return v.text;
    case "number": return String(v.n);
    case "ref": return v.title;
    case "date":
      if (v.date.kind === "relative") return describeRelative(v.date.expr);
      const d = v.date.day;
      return `${d % 100} ${MONTHS[Math.floor((d % 10000) / 100) - 1]} ${Math.floor(d / 10000)}`;
  }
}

const value = valueText;
const list = (vals: Value[]) => vals.map(value).join(", ");

const PHRASE: Record<OperatorId, (vals: Value[]) => string> = {
  "contains-any": (v) => (v.length === 1 ? `is ${value(v[0])}` : `is any of ${list(v)}`),
  "contains-all": (v) => `has all of ${list(v)}`,
  "not-contains": (v) => (v.length === 1 ? `is not ${value(v[0])}` : `is none of ${list(v)}`),
  gt: (v) => `is greater than ${value(v[0])}`,
  lt: (v) => `is less than ${value(v[0])}`,
  between: (v) => `is between ${value(v[0])} and ${value(v[1])}`,
  eq: (v) => `is on ${value(v[0])}`,
  before: (v) => `is before ${value(v[0])}`,
  "on-or-before": (v) => `is on or before ${value(v[0])}`,
  after: (v) => `is after ${value(v[0])}`,
  "on-or-after": (v) => `is on or after ${value(v[0])}`,
  empty: () => "is empty",
  "not-empty": () => "is not empty",
  has: () => "is set",
  "not-has": () => "is not set",
  true: () => "is true",
  false: () => "is false",
};

function tags(ts: TagClause[]): string {
  if (!ts.length) return "all nodes";
  if (ts.length === 1 && !ts[0].tag) return ts[0].not ? "untagged nodes" : "tagged nodes";
  const parts = ts.map((t, i) => {
    const name = t.tag ? t.tag.title : "any tag";
    const word = t.not ? `not ${name}` : name;
    return i === 0 ? word : `${t.join} ${word}`;
  });
  return `${parts.join(" ")} nodes`;
}

function rowText(r: FilterRow): string {
  const core = `${r.property!.title} ${PHRASE[r.op!](r.values)}`;
  return r.not ? `not (${core})` : core;
}

function content(c: ContentClause): string {
  const q = `"${c.value}"`;
  switch (c.op) {
    case "contains": return `text contains ${q}`;
    case "not-contains": return `text does not contain ${q}`;
    case "starts-with": return `text starts with ${q}`;
    case "matches": return `text matches /${c.value}/`;
  }
}

const targetText = (t: RefTarget): string =>
  t.kind === "node" ? t.title : `any ${t.tag.title}${t.name.trim() ? ` named like "${t.name.trim()}"` : ""}`;

/** One reference row as a verb phrase: "link to X", "do not link to X". */
export function refText(r: RefRow): string {
  const t = targetText(r.target!);
  switch (r.dir) {
    case "links-to": return `${r.not ? "do not link to" : "link to"} ${t}`;
    case "linked-from": return `${r.not ? "are not linked from" : "are linked from"} ${t}`;
    case "ancestor-links-to": return `${r.not ? "have no ancestor linking to" : "have an ancestor linking to"} ${t}`;
    case "under": return `${r.not ? "are not on a page under" : "are on a page under"} ${t}`;
  }
}

function scope(q: Query): string {
  switch (q.scope.kind) {
    case "anywhere": return "";
    case "on-page": return ` on ${q.scope.page.title}`;
    case "referenced-in": return ` referenced in ${q.scope.page.title}`;
    case "library": return " in the Library";
  }
}

export function readback(q: Query): string {
  const rows = q.rows.filter(rowComplete);
  const clauses = rows.map((r, i) => (i === 0 ? rowText(r) : `${r.join} ${rowText(r)}`));
  if (q.content) clauses.push(`${clauses.length ? "and " : ""}${content(q.content)}`);
  const refs = q.refs.filter(refComplete).map((r, i) => (i === 0 ? refText(r) : `${r.join} ${refText(r)}`));
  const subject = tags(q.tags) + scope(q) + (refs.length ? ` that ${refs.join(" ")}` : "");
  return clauses.length ? `${subject} where ${clauses.join(" ")}` : subject;
}
