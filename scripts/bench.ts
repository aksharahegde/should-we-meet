/**
 * Runs every sample thread against a running dev server and prints the call, the
 * latency, and the signals that have been worth watching. Unit tests stub Jev's
 * answers, so this is the only thing that catches a rubric drifting.
 *
 *   bun run dev            # in one shell
 *   npm run bench          # in another
 */
import { SAMPLES } from '../app/samples.ts'

const PORT = process.argv[2] ?? '3000'
const WATCH = ['gone_quiet', 'deferred_with_a_date', 'brought_a_decider', 'asked_to_walk_through_live']

let mismatches = 0

for (const s of SAMPLES) {
  const r: any = await fetch(`http://localhost:${PORT}/api/decide`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ thread: s.thread, note: s.note ?? '', invitePending: s.invitePending ?? false }),
  }).then((x) => x.json())

  const got = r.decision?.toUpperCase()
  const ok = s.expected.toUpperCase().startsWith(got) || s.expected.toUpperCase().includes(` ${got}`)
  if (!ok) mismatches++
  const sig = Object.fromEntries(r.signals.map((x: any) => [x.id, `${x.answer[0]}${Math.round(x.certainty * 100)}`]))

  console.log(
    ok ? '  ' : '!!',
    got.padEnd(6),
    `${String(r.ms).padStart(5)}ms`,
    s.expected.split(':')[0].padEnd(13),
    WATCH.map((w) => `${w.slice(0, 9)}=${sig[w]}`).join(' '),
    '|',
    s.name,
  )
}

console.log(`\n${SAMPLES.length - mismatches}/${SAMPLES.length} matched the expected call.`)
process.exit(mismatches ? 1 : 0)
