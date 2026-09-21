import { strict as assert } from 'node:assert'
import test from 'node:test'
import { matchVerdict, parseCandidates, type MatchAnswers } from './match.ts'

test('parses legal name and short name across the pipe', () => {
  const c = parseCandidates('Northline Freight Pte. Ltd. | Northline\nPebble Goods LLC')
  assert.deepEqual(c, [
    { legalName: 'Northline Freight Pte. Ltd.', shortName: 'Northline' },
    { legalName: 'Pebble Goods LLC' },
  ])
})

test('a second pipe is swallowed into the short name', () => {
  const c = parseCandidates('Kite & Co. International Ltd. | Kite & Co | also Kite')
  assert.equal(c[0]!.shortName, 'Kite & Co | also Kite')
})

test('dedupes by legal name, trim and case-insensitive, keeping the first line', () => {
  const c = parseCandidates('Pebble Goods LLC | Pebble\n  pebble goods llc  | Duplicate\nKite & Co. International Ltd.')
  assert.equal(c.length, 2)
  assert.equal(c[0]!.shortName, 'Pebble')
})

test('empty lines are ignored', () => {
  const c = parseCandidates('Pebble Goods LLC\n\n   \nKite & Co. International Ltd.')
  assert.equal(c.length, 2)
})

const CANDIDATES = [
  { legalName: 'Northline Freight Pte. Ltd.', shortName: 'Northline' },
  { legalName: 'Northline Cold Chain Pte. Ltd.', shortName: 'Northline Cold Chain' },
  { legalName: 'Kite & Co. International Ltd.', shortName: 'Kite & Co' },
]

function answers(pick: number | 'none', confidence: number, probs: Record<string, number>, junk = 0): MatchAnswers {
  return {
    match: { choice: pick === 'none' ? 'none' : `c${pick}`, confidence, probabilities: probs },
    junk: { noul: junk },
  }
}

test('clear partial match writes the legal name, never the short name', () => {
  const v = matchVerdict(answers(0, 0.95, { c0: 0.95, c1: 0.03, c2: 0.02, none: 0 }), CANDIDATES, 'northlne freight')
  assert.equal(v.legalName, 'Northline Freight Pte. Ltd.')
  assert.equal(v.confidence, 'clear')
  assert.equal(v.nextStep, 'write "Northline Freight Pte. Ltd." as the customer')
  assert.match(v.why, /Northline Freight Pte\. Ltd\./)
})

test('house not on the list — none of these, no invented legal name', () => {
  const v = matchVerdict(answers('none', 0.95, { c0: 0, c1: 0, c2: 0.03, none: 0.97 }), CANDIDATES, 'harbor and vale logistics')
  assert.equal(v.legalName, null)
  assert.equal(v.nextStep, 'leave unmatched. do not invent a legal name')
})

test('junk extract — none of these, phrased from the junk read', () => {
  const v = matchVerdict(answers('none', 0.9, { c0: 0, c1: 0, c2: 0, none: 1 }, 0.95), CANDIDATES, 'invoice 4481 west dock')
  assert.equal(v.legalName, null)
  assert.match(v.why, /not a company name/)
})

test('a close runner-up never reads as clear, even at high confidence (rule 5)', () => {
  const v = matchVerdict(answers(0, 0.95, { c0: 0.55, c1: 0.4, c2: 0.05, none: 0 }), CANDIDATES, 'Northline Freight Traders')
  assert.equal(v.confidence, 'leaning')
  assert.equal(v.nextStep, 'confirm "Northline Freight Pte. Ltd." before writing')
  assert.match(v.why, /not a clear pick/)
})

test('a decisive winner still reads as clear, even in a family with a cousin', () => {
  const v = matchVerdict(answers(0, 0.99, { c0: 0.99, c1: 0, c2: 0.01, none: 0 }), CANDIDATES, 'Northline Freight Traders')
  assert.equal(v.confidence, 'clear')
})

test('low confidence reads as thin and asks for confirmation', () => {
  const v = matchVerdict(answers(0, 0.4, { c0: 0.4, c1: 0.35, c2: 0.15, none: 0.1 }), CANDIDATES, 'N0RTHL1NE FRE1GHT TRD')
  assert.equal(v.confidence, 'thin')
  assert.match(v.nextStep, /confirm/)
  assert.match(v.why, /misspelled or OCR/)
})

test('scores come back sorted by probability, one row per candidate plus none', () => {
  const v = matchVerdict(answers(0, 0.9, { c0: 0.7, c1: 0.2, c2: 0.05, none: 0.05 }), CANDIDATES, 'Northline Freight Ltd')
  assert.equal(v.scores.length, 4)
  assert.deepEqual(v.scores.map((s) => s.pct), [0.7, 0.2, 0.05, 0.05])
  assert.ok(v.scores.some((s) => s.isNone))
})
