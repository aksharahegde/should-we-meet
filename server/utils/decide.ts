import { choice, noul, score } from '@typesafe-ai/sdk'

export type Decision = 'meet' | 'async' | 'wait' | 'drop'

/** Ascending caution: drop is the most cautious call, meet the least. */
const CAUTION: Decision[] = ['drop', 'wait', 'async', 'meet']

const NEXT_STEP: Record<Decision, string> = {
  meet: 'Offer two times this week. Keep the agenda to the decision they named.',
  async: 'Send the comparison they asked for. Do not attach a calendar hold.',
  wait: 'One check-in on the date they mentioned. No new meeting invite.',
  drop: 'Close the loop politely. Do not offer another slot.',
}

export const PULL_LEVELS = [
  'No client voice in this context at all',
  'Client is polite or curious but asks for nothing that needs us live',
  'Client is engaged and asks questions, but names no time, person, or decision',
  'Client explicitly pulls for time, people, or a decision',
] as const

/**
 * One Jev request. The Choice proposes the call, the Nouls are the evidence the
 * rationale is written from, and `evidence_line` picks the line we quote back.
 */
/** Chip-sized names for the same levels, for the signals table. */
const PULL_SHORT = ['no client voice', 'curiosity only', 'engaged, no ask', 'explicit pull'] as const

export function buildQuestions(lineIds: string[]) {
  return {
    decision: choice(
      'Should we book a meeting with this client? Judge only what the CLIENT is pulling for, never our own enthusiasm or pipeline stage.',
      {
        meet: 'The client is pulling for time, people, or a decision.',
        async: 'The client is engaged but wants information, not a slot. They replied warmly, asked for a document, or asked nothing at all. A note, deck, or recording answers them.',
        wait: 'Interest has cooled or been deferred: they went quiet, or pushed us to a later date. Not a fresh reply that simply asks for nothing.',
        drop: 'No real interest, or interest that has ended. Stop proposing meetings.',
      },
    ),
    pull_strength: score('How hard is the CLIENT pulling for our time?', PULL_LEVELS),

    client_replied: noul('Is there at least one message from the client here, as opposed to only our own outreach?', {
      true: 'A client message, reply, or invite is present',
      false: 'Only our outbound, notes we wrote, or an agenda we drafted',
    }),
    proposed_or_accepted_time: noul('Did the client propose or accept a specific time?', {
      true: 'They offered slots, accepted a slot, or named a day',
      false: 'No time came from the client',
    }),
    brought_a_decider: noul('Did the client bring another person in to attend or decide?', {
      true: 'They said they will bring someone, added someone who is asked to decide or attend, or are taking us to a group that decides, such as a board or a panel',
      false: 'Nobody new, or a person merely cc’d, forwarded to, or mentioned in passing without being asked to attend or decide',
    }),
    asked_to_walk_through_live: noul(
      'Did the CLIENT ask us to be present live, or ask us into their process? Our own offer of a call never counts.',
      {
        true: 'The client asked for a demo, a walkthrough, a vendor panel, or a presentation to their people',
        false: 'Nothing the client asked for needs us present, or the only such offer came from us',
      },
    ),
    asked_for_document_only: noul('Is the client asking for a document rather than a conversation?', {
      true: 'Send the deck, pricing, a one-pager, or a written answer',
      false: 'They asked for something a document cannot give them',
    }),
    closed_door: noul('Has the client closed the door?', {
      true: 'A clear no, another vendor chosen, budget frozen, wrong problem, or asked us to stop emailing',
      false: 'The door is open or merely quiet',
    }),
    deferred_with_a_date: noul(
      'Did the client push us to a LATER point instead of now? A time they offered to meet is the opposite of this: it is not a deferral.',
      {
        true: 'They said not now and named when to return: “next quarter”, “after the migration”, “ping me in January”',
        false: 'They named no return point, or the date they named is a time to meet rather than a time to wait until',
      },
    ),
    gone_quiet: noul(
      'Has the client gone quiet? Judge only from the timestamps in the thread, the note, and `today`. A short or recent exchange with no sign of a gap is not silence.',
      {
        true: 'Their last substantive reply is old, or they stopped answering after we wrote',
        false: 'They are replying at a normal pace, or the thread is too short or too recent to show a gap',
      },
    ),

    evidence_line: choice(
      'Which single line best explains what the CLIENT wants from us? Pick a line the client wrote, not one of ours. Pick `none` if the client wrote nothing.',
      Object.fromEntries([...lineIds.map((id) => [id, null]), ['none', 'The client wrote nothing here']]),
    ),
  }
}

/** The shape of `response.answers` that `verdict` reads. Kept structural so tests can stub it. */
export type Answers = {
  decision: { choice: string; confidence: number }
  pull_strength: { score: number; confidence?: number }
  evidence_line: { choice: string }
} & Record<string, { noul?: number; score?: number; choice?: string; confidence?: number }>

const nl = (a: Answers, k: string) => a[k]?.noul ?? 0

/** One evidence row, as the UI shows it: the question, the read, and how sure that read is. */
export type Signal = { id: string; label: string; answer: string; certainty: number }

export type Verdict = {
  decision: Decision
  proposed: Decision
  confidence: 'clear' | 'leaning' | 'thin evidence'
  score: number
  why: string
  nextStep: string
  quote: string | null
  signals: Signal[]
}

/** Table voice: the question we asked, phrased for a reader. */
const LABEL: Record<string, string> = {
  proposed_or_accepted_time: 'Client proposed or accepted a time?',
  brought_a_decider: 'Brought someone in to decide or attend?',
  asked_to_walk_through_live: 'Asked for something live?',
  asked_for_document_only: 'Asked for a document, not a slot?',
  client_replied: 'Any client message in this paste?',
  gone_quiet: 'Gone quiet since their last useful reply?',
  deferred_with_a_date: 'Named a point to come back at?',
  closed_door: 'Door closed?',
}

/** Prose voice: the same signals, as a sentence fragment. Only fired ones are used. */
const PHRASE: Record<string, string> = {
  proposed_or_accepted_time: 'they put a time on the table',
  brought_a_decider: 'they brought someone in to decide or attend',
  asked_to_walk_through_live: 'they asked for something live',
  asked_for_document_only: 'what they asked for is a document',
  gone_quiet: 'they have gone quiet since their last useful reply',
  deferred_with_a_date: 'they named a point to come back at',
  closed_door: 'they have said no',
}

/**
 * Turns Jev's answers into the call. The product's rules live here, not in the
 * prompt, and they may only move the decision TOWARD caution — a guardrail can
 * never promote something to Meet. Rule 7: Meet needs the strongest evidence.
 */
export function verdict(answers: Answers, lines: Record<string, string> = {}): Verdict {
  const proposed = (CAUTION.includes(answers.decision.choice as Decision)
    ? answers.decision.choice
    : 'wait') as Decision
  const conf = answers.decision.confidence

  let decision = proposed
  const guardrails: string[] = []
  const cap = (max: Decision, reason: string) => {
    if (CAUTION.indexOf(decision) > CAUTION.indexOf(max)) {
      decision = max
      guardrails.push(reason)
    }
  }

  const pull = Math.max(
    nl(answers, 'proposed_or_accepted_time'),
    nl(answers, 'brought_a_decider'),
    nl(answers, 'asked_to_walk_through_live'),
  )
  const hasPull = pull > 0.6
  const replied = nl(answers, 'client_replied') > 0.5

  // Rule 4 + edge case 1: our own outreach is not interest.
  if (!replied) cap('wait', 'there is no client message here, only our side of it')
  // A closed door ends it, whatever the rest of the thread looks like.
  if (nl(answers, 'closed_door') > 0.7) cap('drop', 'the client has closed the door')
  // Rule 7: Meet is earned by pull, not by warmth.
  if (!hasPull) cap('async', 'the client named no time, no attendee, and nothing that needs us live')
  // Rule 2: asking for a document is not asking for a meeting.
  if (nl(answers, 'asked_for_document_only') > 0.7 && !hasPull) cap('async', 'they asked for a document, not a conversation')
  // Rule 4: silence is not interest.
  if (nl(answers, 'gone_quiet') > 0.7 && !hasPull) cap('wait', 'their last useful reply is old')
  // Rule 7 again: when unsure, do not book.
  if (conf < 0.5) cap(decision === 'meet' ? 'async' : decision === 'async' ? 'wait' : decision, 'the evidence is genuinely mixed')

  // Strongest read first, so the five rows the UI shows by default are the five that matter.
  const signals: Signal[] = Object.keys(LABEL)
    .map((id) => {
      const yes = nl(answers, id)
      return { id, label: LABEL[id]!, answer: yes > 0.5 ? 'Yes' : 'No', certainty: yes > 0.5 ? yes : 1 - yes }
    })
    .sort((a, b) => b.certainty - a.certainty)

  const level = Math.round(answers.pull_strength.score)
  signals.unshift({
    id: 'pull_strength',
    label: 'How hard is the client pulling?',
    answer: `${level} (${PULL_SHORT[level] ?? 'unclear'})`,
    certainty: answers.pull_strength.confidence ?? 0,
  })

  // 0.7, not the 0.6 the rules use: a near coin-flip belongs in the table, never in the sentence.
  const fired = Object.keys(PHRASE).filter((id) => nl(answers, id) > 0.7).map((id) => PHRASE[id]!)

  const confidence = !replied ? 'thin evidence' : conf >= 0.8 ? 'clear' : conf >= 0.55 ? 'leaning' : 'thin evidence'
  const quote = lines[answers.evidence_line.choice] ?? null

  const why = [
    quote && `They said: “${quote}”.`,
    fired.length ? `${cap1(list(fired))}.` : null,
    guardrails.length ? `We are not booking because ${guardrails[guardrails.length - 1]}.` : null,
    !replied ? 'No client message in this paste, only our outreach.' : null,
  ]
    .filter(Boolean)
    .join(' ')

  return { decision, proposed, confidence, score: conf, why, nextStep: NEXT_STEP[decision], quote, signals }
}

const cap1 = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}`)
