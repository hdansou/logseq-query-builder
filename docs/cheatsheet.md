# Query Builder cheatsheet

For people who have never written a Logseq query. Open the builder with **⌘⇧F** (or `/Query
Builder` inside a block), read the panel top to bottom, and watch the sentence in the name field
and the result count change as you go.

## The panel in one sentence

> **[Tags] nodes** · **[Scope]** · **that [References]** · **where [Filters]** · **and text [Content]**

Every zone narrows the results. Leave a zone empty and it does nothing.

| Zone | Ask yourself | Example |
|---|---|---|
| **Scope** | Where should I look? | *in the Library*, *on page… Sprint 12* |
| **Tags** | What kind of node? | *Task*, *Task or Bug*, *not Meeting* |
| **Filters** | Which property values? | *Status is Todo*, *Deadline is before +7d* |
| **References** | Linked to what? | *links to Project Iris*, *is linked from any Book* |
| **Content** | Which words in the node's own text? | *contains "invoice"* |

## Ten queries to copy

| I want… | Build |
|---|---|
| All my open tasks | Tags **Task** · Filters **Status is not Done** |
| Urgent tasks due this week | Tags **Task** · Filters **Priority is Urgent** AND **Deadline is on or before +7d** |
| Everything assigned to Maria | Filters **Assignee is Maria** (no tag needed) |
| Tasks on one page | Scope **on page… Sprint 12** · Tags **Task** |
| Pages in my Library without a description | Scope **in the Library** · Tags **Page** · Filters **Description is empty** |
| Every artist mentioned in a book page | Tags **artist** · References **is linked from · Book** (pick the page) |
| Tasks that mention a project | Tags **Task** · References **links to · any project** |
| Tasks indented under a `[[Project Iris]]` line, even without their own link | Tags **Task** · References **ancestor links to · Project Iris** |
| Tasks linked to any project whose client is Acme | Tags **Task** · References **links to · any project** · *+ condition on the target* **Client is Acme** |
| Notes containing a word, anywhere | Content **contains "retro"** |

## Words the builder uses

| Word | Meaning |
|---|---|
| **node** | A block or a page. Everything in the graph is a node. |
| **tag** | What a node *is* (`Task`, `Page`, your own `project`). *Include sub-tags* also matches tags that extend the chosen one. |
| **property** | A typed field on a node (Status, Deadline, Assignee). Filters work on these. |
| **reference** | A link: `[[Page]]` in the text, or a node picked in a node property (Assignee → Maria). |
| **IS / NOT** | The small toggle at the start of a row. NOT inverts that row only. |
| **AND / OR** | Between rows, applied left to right with no parentheses. |
| **any \<tag\>** | As a reference target: every node carrying that tag. Narrow it with *named like…* or a condition. |

## Dates

Type them: `today`, `tomorrow`, `yesterday`, `+7d`, `-1w`, `+1m`, `-1y`, or a day like
`2026-10-02`. Relative dates stay relative after you insert the query, so "due in the next 7 days"
keeps working next month.

## References, plainly

| Direction | Means | Picture |
|---|---|---|
| **links to X** | the node mentions X, in its text or a node property | node → X |
| **is linked from X** | X mentions the node (for a page: any block on X) | X → node |
| **ancestor links to X** | the node, or a block it sits under, mentions X | (parent → X) ⊃ node |
| **on page under X** | the node lives on X or on a page nested below X | X ⊃ page ⊃ node |

One hop only: a task that links to a project that links to a client does *not* "link to" the
client. Ask that as **links to · any project · whose Client is Acme** instead.

## Keys

| Key | Does |
|---|---|
| ⌘⇧F | open / close the builder |
| Tab · ⇧Tab | next / previous control |
| ↩ | pick the highlighted option |
| ⇧↩ | add a filter row |
| ⌘↩ | insert the query into the page |
| Esc | close the list, then the panel |

## Insert, then edit later

**Insert** writes a live `#Query` block named after the sentence in the name field (edit the name
first if you like). The block keeps your choices, so opening the builder while editing that block
brings the same chips back. The **datalog** toggle in the footer shows the query text if you are
curious; you never need to read it.

## When nothing shows up

- The amber bar says *Add a tag, a filter, a reference or a content search*: a NOT row alone
  cannot run. Add something positive.
- **0 nodes** with a tag and a filter: check *include sub-tags*, and whether the property belongs
  to that tag (the picker shows the owner beside each property).
- A reference row returns *Status* or *Task*-like pages: pick a tag for the results, the builder
  already hides tags-as-references in the common cases.
- Results look stale after editing the graph: change any control, the preview re-runs.
