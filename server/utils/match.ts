import { choice, noul } from '@typesafe-ai/sdk'

export type Candidate = { legalName: string; shortName?: string }

export const MIN_CANDIDATES = 2
export const MAX_CANDIDATES = 12

/**
 * Parses "legal name | short name" lines, one candidate per line. A second `|` is
 * swallowed into the short name rather than starting a third field. Dedupes by legal
 * name (trim, case-insensitive), keeping the first line seen; empty lines are ignored.
 */
export function parseCandidates(raw: string): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [legalPart, ...rest] = trimmed.split('|')
    const legalName = legalPart!.trim()
    if (!legalName) continue
    const key = legalName.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const shortName = rest.length ? rest.join('|').trim() || undefined : undefined
    out.push(shortName ? { legalName, shortName } : { legalName })
  }
  return out
}

/**
 * One Jev request. `match` is the whole call — a candidate's legal name is never a
 * criteria value, only its key, so the model cannot answer with the short name. `junk`
 * is a separate, narrow read used only to phrase a `none` outcome; it never overrides
 * `match`, so the two can't contradict each other the way two competing choices could.
 */
export function buildMatchQuestions(candidates: Candidate[], kind = 'customer') {
  const criteria = Object.fromEntries([
    ...candidates.map((c, i) => [
      `c${i}`,
      c.shortName
        ? `${c.legalName} — also called or abbreviated "${c.shortName}" on documents, in speech, or by extractors.`
        : c.legalName,
    ]),
    ['none', 'None of the listed options is a confident match for the extract.'],
  ])

  return {
    match: choice(
      `A name-extraction tool pulled a ${kind} value from a document; it is often partial or misspelled. Pick the correct ` +
        `${kind} from the list below, or \`none\` if no listed option is a confident match. Partial spellings, misspellings ` +
        'or OCR noise, extra words, and abbreviations or short names are all evidence for the option they belong to. Never ' +
        `invent a ${kind} that is not on the list, and never let two close options both look right without separating ` +
        'them — prefer the closer one or `none` instead of guessing.',
      criteria,
    ),
    junk: noul(`Is the extracted text something other than a plausible ${kind} value — unrelated text, a stray number, or garbage OCR?`, {
      true: `Not a plausible ${kind} value at all`,
      false: `Names, or tries to name, a ${kind}`,
    }),
  }
}

export type MatchAnswers = {
  match: { choice: string; confidence: number; probabilities: Record<string, number> }
  junk: { noul: number }
}

export type Confidence = 'clear' | 'leaning' | 'thin'

export type ScoreRow = { label: string; shortName?: string; pct: number; isNone?: boolean }

export type MatchResult = {
  legalName: string | null
  shortName?: string
  confidence: Confidence
  score: number
  why: string
  nextStep: string
  scores: ScoreRow[]
}

/**
 * Turns Jev's answers into the call. The written answer is always a submitted legal
 * name or `none of these` — `match.choice` already guarantees that, since its criteria
 * keys are candidate indexes, never the names themselves.
 */
export function matchVerdict(answers: MatchAnswers, candidates: Candidate[], extracted: string, kind = 'customer'): MatchResult {
  const idx = answers.match.choice === 'none' ? -1 : Number(answers.match.choice.slice(1))
  const winner = idx >= 0 ? (candidates[idx] ?? null) : null
  const conf = answers.match.confidence

  const sorted = Object.values(answers.match.probabilities).sort((a, b) => b - a)
  const margin = (sorted[0] ?? 0) - (sorted[1] ?? 0)

  let confidence: Confidence = conf >= 0.8 ? 'clear' : conf >= 0.5 ? 'leaning' : 'thin'
  // Rule 5: a close runner-up (typically a legal entity in the same family) is never a "clear" call.
  if (winner && margin < 0.3 && confidence === 'clear') confidence = 'leaning'

  const legalName = winner?.legalName ?? null
  const noun = kind === 'customer' ? 'legal name' : 'value'
  const nextStep = legalName === null
    ? `leave unmatched. do not invent a ${noun}`
    : confidence === 'clear'
      ? `write "${legalName}" as the ${kind}`
      : `confirm "${legalName}" before writing`

  const scores: ScoreRow[] = [
    ...candidates.map((c, i) => ({ label: c.legalName, shortName: c.shortName, pct: answers.match.probabilities[`c${i}`] ?? 0 })),
    { label: 'none of these', pct: answers.match.probabilities.none ?? 0, isNone: true },
  ].sort((a, b) => b.pct - a.pct)

  const why = winner
    ? buildMatchWhy(extracted, winner, candidates, margin < 0.3)
    : answers.junk.noul > 0.6
      ? 'The extract is not a company name, so no legal name on the list applies.'
      : 'No listed legal name is a confident match for this extract.'

  return { legalName, shortName: winner?.shortName, confidence, score: conf, why, nextStep, scores }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tokens = (s: string) => norm(s).split(' ').filter(Boolean)

/**
 * Describes how the extract relates to the winning legal name, from the strings alone —
 * not from a second model judgment, so this can never disagree with `match` itself.
 */
function howMatched(extracted: string, winner: Candidate): string {
  const e = norm(extracted)
  if (e === norm(winner.legalName)) return 'is an exact match for'
  if (winner.shortName) {
    if (e === norm(winner.shortName)) return 'matches the short name on file for'
    const shortTokens = tokens(winner.shortName)
    if (shortTokens.length && shortTokens.every((t) => e.includes(t))) return 'matches the short name on file for'
  }
  const eTokens = tokens(extracted)
  const legalTokens = tokens(winner.legalName)
  const shared = legalTokens.filter((t) => eTokens.includes(t)).length
  if (shared >= Math.ceil(legalTokens.length / 2)) return 'is a partial or truncated version of'
  return 'is a misspelled or OCR-noisy version of'
}

function buildMatchWhy(extracted: string, winner: Candidate, candidates: Candidate[], closeCall: boolean): string {
  const others = candidates.filter((c) => c !== winner).map((c) => c.legalName).slice(0, 2)
  const rival = others.length ? ` ${list(others)} ${others.length > 1 ? 'are' : 'is'} a different house.` : ''
  const caveat = closeCall ? ' Another legal name on the list is close enough that this is not a clear pick.' : ''
  return `Extract ${howMatched(extracted, winner)} ${winner.legalName}.${rival}${caveat}`
}

const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}`)
