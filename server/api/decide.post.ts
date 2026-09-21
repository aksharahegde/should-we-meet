import { TypeSafeClient } from '@typesafe-ai/sdk'
import { buildQuestions, verdict, type Answers } from '../utils/decide.ts'

const MAX_CHARS = 20_000
/** Choice allows 255 options; the last 120 lines is plenty of thread and leaves headroom. */
const MAX_LINES = 120

let client: TypeSafeClient | undefined

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    thread?: unknown
    weAre?: unknown
    ourAsk?: unknown
    note?: unknown
    invitePending?: unknown
  }>(event)

  const thread = typeof body?.thread === 'string' ? body.thread.trim() : ''
  if (!thread) throw createError({ statusCode: 400, statusMessage: 'Paste a thread first.' })
  if (thread.length > MAX_CHARS) {
    throw createError({ statusCode: 413, statusMessage: `Keep it under ${MAX_CHARS} characters.` })
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 500) : '')

  // Number the lines so Jev can point at one and we can quote it back verbatim.
  const kept = thread.split('\n').map((l) => l.trim()).filter(Boolean).slice(-MAX_LINES)
  const lines = Object.fromEntries(kept.map((text, i) => [`L${i + 1}`, text]))

  const apiKey = useRuntimeConfig(event).typesafeApiKey
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'NUXT_TYPESAFE_API_KEY is not set.' })
  client ??= new TypeSafeClient({ apiKey, timeout: 20_000 })

  const response = await client.systemOne({
    state: {
      thread: Object.entries(lines).map(([id, text]) => `${id}: ${text}`),
      we_are: str(body.weAre) || null,
      our_ask: str(body.ourAsk) || null,
      note: str(body.note) || null,
      // Rule 6: a meeting already on the calendar can still be Async.
      invite_already_sent: body.invitePending === true,
      today: new Date().toISOString().slice(0, 10),
    },
    questions: buildQuestions(Object.keys(lines)),
  })

  return {
    ...verdict(response.answers as unknown as Answers, lines),
    model: response.model,
    usage: response.usage,
  }
})
