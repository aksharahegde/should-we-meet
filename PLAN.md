# Should We Meet? — build plan (Nuxt + Jev)

## The one constraint that shapes everything

Jev does not generate text. It returns typed answers with probability
distributions in one parallel pass (70–500ms, ~$0.042/M input, output free).

So:
- the **decision** is a Choice question — native fit
- the **evidence signals** are Noul questions — native fit
- the **quoted client line** is a Choice over numbered lines (the line-by-line
  search cookbook trick) — native fit
- the **2–4 sentence rationale is NOT model output**. It is templated from the
  evidence Nouls + the quoted line. No second LLM in v1.

One API call per submit. Everything below rides in that one call.

## Stack

- Nuxt 4, SSR, one page
- `@typesafe-ai/sdk` (Node 20+), **server-side only** — key never reaches the browser
- No DB, no auth, no Pinia. Overrides go to `localStorage`.
- No UI kit. One page, one `<style>` block.

## Files (5)

```
nuxt.config.ts
app.vue                       # the one screen
server/api/decide.post.ts     # validate input, call Jev, apply rules
server/utils/decide.ts        # buildQuestions() + verdict() — pure, testable
server/utils/decide.test.ts   # node --test, the spec's edge-case table
.env                          # TYPESAFE_API_KEY
```

## The Jev call

`state` is structured, not a blob:

```ts
state: {
  thread: lines,              // ["L1: ...", "L2: ...", ...] max 120
  we_are: form.weAre,         // optional: our name/domain
  our_ask: form.ourAsk,       // optional: what we were going to propose
  invite_already_sent: bool,  // the toggle
  note: form.note,            // "it's been 3 weeks"
  today: new Date().toISOString().slice(0,10)
}
```

Questions (one request, all parallel):

| id | type | purpose |
|---|---|---|
| `decision` | choice | meet / async / wait / drop — rubric lifted verbatim from the spec table |
| `pull_strength` | score | ["no client voice","curiosity only","soft interest","explicit pull"] |
| `client_replied` | noul | is there any client message at all (rule: thin evidence) |
| `proposed_or_accepted_time` | noul | pull signal |
| `brought_a_decider` | noul | pull only if asked to decide/attend, not cc'd (rule 3) |
| `asked_to_walk_through_live` | noul | pull signal |
| `asked_for_document_only` | noul | curiosity, not pull (rule 2) |
| `closed_door` | noul | clear no / other vendor / budget frozen / stop emailing |
| `deferred_with_a_date` | noul | Wait vs Drop split |
| `gone_quiet` | noul | last useful client reply is old |
| `evidence_line` | choice | over `L1..Ln` — the client line that best explains the call |

Noul `criteria: {true, false}` on each — the spec's bullet lists are the rubric.
Choice `criteria` = option → description. Keep `model: "jev-latest"`.

## Rules engine (`verdict()`, pure, downgrade-only)

Jev's `decision` is the proposal. The spec's "Rules of the product" are code, and
they may only **downgrade** toward caution — never promote to Meet.

```
if !client_replied            -> cap at wait (drop if closed_door)   # edge case 1
if closed_door > .7           -> drop
if decision == meet and not (proposed_or_accepted_time > .6
                             or brought_a_decider > .6
                             or asked_to_walk_through_live > .6)
                              -> async                                # rule 7
if asked_for_document_only > .7 and pull_strength < 2 -> async       # rule 2
if gone_quiet > .7 and no pull signal -> deferred_with_a_date > .5 ? wait : drop
if decision.confidence < .5   -> downgrade meet->async, async->wait   # confidence floor
invite_already_sent changes nothing                                   # rule 6
```

Confidence wording: `conf >= .8 && client_replied > .5` → *clear*;
`>= .55` → *leaning*; else *thin evidence*. `!client_replied` forces *thin evidence*
plus the literal line "no client message in this paste — only our outreach".

Rationale template (no LLM):
`"{quoted evidence line}" + the one or two fired signals + the guardrail note if one fired.`
Next step: a 4-entry lookup keyed by final decision, straight from the spec.

## Tests

`node --test server/utils/decide.test.ts`. The spec's edge-case table *is* the
suite — 10 asserts over `verdict()` with hand-written Jev answer fixtures. No
network, no framework. One extra live smoke test behind `TYPESAFE_API_KEY`.

## Phases

1. `nuxt init`, `.env`, `server/api/decide.post.ts` returning raw Jev answers. Curl it.
2. `decide.ts` questions + `verdict()` + the edge-case tests. This is the product.
3. `app.vue`: textarea, two optional fields, invite toggle, submit. Output: decision
   word huge, rationale, one next step, confidence phrase.
4. Override: 4 buttons + one-line reason → `localStorage`. Shown as a strip under the call.

## Skipped, and when to add

- **History / DB** — spec says not required for first release. Add Postgres when you
  want cross-user learning from overrides, not before.
- **LLM-written rationale** — the template covers "name the evidence". Add a small
  model only if the templated sentences read robotic in real threads.
- **Streaming / optimistic UI** — 500ms doesn't need it.
- **Email/CRM ingestion** — paste is the spec's input.
