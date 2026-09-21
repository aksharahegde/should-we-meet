import { TypeSafeClient } from '@typesafe-ai/sdk'
import { buildMatchQuestions, MAX_CANDIDATES, MIN_CANDIDATES, matchVerdict, parseCandidates, type MatchAnswers } from '../utils/match.ts'

let client: TypeSafeClient | undefined

const KINDS = new Set(['customer', 'class', 'rep', 'supplier'])

export default defineEventHandler(async (event) => {
  const body = await readBody<{ extracted?: unknown; candidates?: unknown; kind?: unknown }>(event)

  const extracted = typeof body?.extracted === 'string' ? body.extracted.trim() : ''
  if (!extracted) throw createError({ statusCode: 400, statusMessage: 'paste the name as extracted' })

  const kind = typeof body?.kind === 'string' && KINDS.has(body.kind) ? body.kind : 'customer'

  const candidates = parseCandidates(typeof body?.candidates === 'string' ? body.candidates : '')
  if (candidates.length < MIN_CANDIDATES) throw createError({ statusCode: 400, statusMessage: 'add at least two possible matches' })
  if (candidates.length > MAX_CANDIDATES) throw createError({ statusCode: 400, statusMessage: 'too many options for this demo. keep it to 12.' })

  const apiKey = useRuntimeConfig(event).typesafeApiKey
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'NUXT_TYPESAFE_API_KEY is not set.' })
  client ??= new TypeSafeClient({ apiKey, timeout: 20_000 })

  const started = Date.now()
  const response = await client.systemOne({
    state: {
      extracted_value: extracted,
      candidates: candidates.map((c, i) => `c${i}: ${c.legalName}${c.shortName ? ` | ${c.shortName}` : ''}`),
    },
    questions: buildMatchQuestions(candidates, kind),
  })

  return {
    ...matchVerdict(response.answers as unknown as MatchAnswers, candidates, extracted, kind),
    ms: Date.now() - started,
    model: response.model,
    usage: response.usage,
  }
})
