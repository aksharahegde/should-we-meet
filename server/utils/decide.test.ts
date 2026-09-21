import { strict as assert } from 'node:assert'
import test from 'node:test'
import { verdict, type Answers, type Decision } from './decide.ts'

/** A neutral answer set: client replied, nothing else fired. Override per case. */
function answers(decision: Decision, over: Record<string, number> = {}, confidence = 0.9, line = 'none'): Answers {
  const base = {
    client_replied: 1,
    proposed_or_accepted_time: 0,
    brought_a_decider: 0,
    asked_to_walk_through_live: 0,
    asked_for_document_only: 0,
    closed_door: 0,
    deferred_with_a_date: 0,
    gone_quiet: 0,
    ...over,
  }
  return {
    decision: { choice: decision, confidence },
    pull_strength: { score: 1 },
    evidence_line: { choice: line },
    ...Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { noul: v }])),
  } as Answers
}

const call = (...a: Parameters<typeof answers>) => verdict(answers(...a)).decision

// The edge-case table from the spec.
test('only our outbound, no client reply — never Meet', () => {
  assert.equal(call('meet', { client_replied: 0 }), 'wait')
})

test('client asked for pricing only — Async', () => {
  assert.equal(call('meet', { asked_for_document_only: 0.95 }), 'async')
})

test('client offered two time slots — Meet', () => {
  assert.equal(call('meet', { proposed_or_accepted_time: 0.95 }), 'meet')
})

test('“let’s regroup next quarter” — Wait when a date exists', () => {
  assert.equal(call('wait', { gone_quiet: 0.8, deferred_with_a_date: 0.9 }), 'wait')
})

test('champion loves us, buyer silent — not Meet', () => {
  assert.equal(call('meet', { gone_quiet: 0.4 }), 'async')
})

test('champion is booking the buyer — Meet', () => {
  assert.equal(call('meet', { brought_a_decider: 0.9, proposed_or_accepted_time: 0.8 }), 'meet')
})

test('vendor panel we were asked into — Meet', () => {
  assert.equal(call('meet', { asked_to_walk_through_live: 0.9, proposed_or_accepted_time: 0.85 }), 'meet')
})

test('“can you present to the board” — Meet', () => {
  assert.equal(call('meet', { asked_to_walk_through_live: 0.92, brought_a_decider: 0.8 }), 'meet')
})

test('“Looks great!” and nothing else — Async', () => {
  assert.equal(call('async'), 'async')
})

test('hostile or “please stop emailing” — Drop', () => {
  assert.equal(call('async', { closed_door: 0.95 }), 'drop')
})

// Rules that are not in the table but are in the spec.
test('rule 6: an invite on the calendar does not force Meet', () => {
  // invite_already_sent rides in state only; it has no vote here by design.
  assert.equal(call('meet', { asked_for_document_only: 0.9 }), 'async')
})

test('rule 7: low confidence downgrades one step toward caution', () => {
  assert.equal(call('meet', { proposed_or_accepted_time: 0.95 }, 0.3), 'async')
  assert.equal(call('async', {}, 0.3), 'wait')
})

test('a guardrail never promotes toward Meet', () => {
  assert.equal(call('drop', { proposed_or_accepted_time: 0.99, brought_a_decider: 0.99 }), 'drop')
  assert.equal(call('wait', { proposed_or_accepted_time: 0.99 }), 'wait')
})

test('silence with real pull still books', () => {
  assert.equal(call('meet', { gone_quiet: 0.9, proposed_or_accepted_time: 0.9 }), 'meet')
})

test('rationale quotes the client line and says what is missing', () => {
  const v = verdict(answers('meet', { client_replied: 0 }, 0.9, 'L2'), { L2: 'Send the deck when you can.' })
  assert.match(v.why, /Send the deck when you can/)
  assert.match(v.why, /only our outreach/i)
  assert.equal(v.confidence, 'thin evidence')
  assert.equal(v.proposed, 'meet')
  assert.match(v.nextStep, /check-in/)
})

test('signals come back strongest-read-first, with pull strength on top', () => {
  const v = verdict(answers('meet', { proposed_or_accepted_time: 0.95, gone_quiet: 0.5 }))
  assert.equal(v.signals[0]!.id, 'pull_strength')
  const rest = v.signals.slice(1)
  assert.deepEqual([...rest].sort((a, b) => b.certainty - a.certainty), rest)
  const time = rest.find((s) => s.id === 'proposed_or_accepted_time')!
  assert.equal(time.answer, 'Yes')
  assert.equal(Math.round(time.certainty * 100), 95)
  // A no-answer reports how sure we are of the no, not the raw yes probability.
  assert.equal(rest.find((s) => s.id === 'closed_door')!.answer, 'No')
  assert.equal(rest.find((s) => s.id === 'closed_door')!.certainty, 1)
})
