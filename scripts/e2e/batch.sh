#!/bin/sh
cd "$(dirname "$0")"   # run from scripts/e2e; needs the second instance (test-logseq-desktop) on :9333 with qb-e2e-persona open
: > results.jsonl
node -e 'for (const s of require("./scenarios.json")) console.log(JSON.stringify(s))' | while IFS= read -r line; do
  id=$(printf '%s' "$line" | node -e 'process.stdin.on("data",d=>process.stdout.write(JSON.parse(d).id))')
  steps=$(printf '%s' "$line" | node -e 'process.stdin.on("data",d=>process.stdout.write(JSON.stringify(JSON.parse(d).steps)))')
  out=$(STEPS="$steps" node ~/.claude/skills/test-logseq-desktop/scripts/frame.mjs qb.js --port 9333 --frame logseq-query-builder 2>&1)
  printf '%s\t%s\n' "$id" "$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.stringify(JSON.parse(s));process.stdout.write(JSON.stringify(JSON.parse(s)))}catch{process.stdout.write(JSON.stringify({error:s.slice(0,400)}))}})')" >> results.jsonl
done
node -e '
const fs=require("fs"); const exp=Object.fromEntries(require("./scenarios.json").map(s=>[s.id,s.expect]));
for (const l of fs.readFileSync("results.jsonl","utf8").trim().split("\n")) { const [id,j]=l.split("\t"); const r=JSON.parse(j);
  const n=r.count?parseInt(r.count):NaN; const ok=r.error?"ERR ":exp[id]==null?"rec ":n===exp[id]?"ok  ":"DIFF";
  console.log(ok, id.padEnd(5), String(exp[id]).padStart(4), "got", String(r.count).padEnd(9), "|", r.readback ?? r.error?.slice(0,120), r.log?.length?("| "+r.log.join("; ")):""); }'
