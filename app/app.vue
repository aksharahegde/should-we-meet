<script setup lang="ts">
import type { Decision, Verdict } from '../server/utils/decide'
import { SAMPLES } from './samples'

const DECISIONS: { id: Decision; title: string; sub: string; icon: string }[] = [
  { id: 'async', title: 'Async', sub: 'Send something', icon: 'M6 2h7l5 5v15H6zM13 2v5h5' },
  { id: 'meet', title: 'Meet', sub: 'Book a call', icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4' },
  { id: 'wait', title: 'Wait', sub: 'Check back', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2' },
  { id: 'drop', title: 'Drop', sub: 'Close the loop', icon: 'M4 6h16M9 6V4h6v2M7 6l1 15h8l1-15' },
]

const thread = ref('')
const weAre = ref('')
const ourAsk = ref('')
const note = ref('')
const invitePending = ref(false)

const sample = ref('')
const result = ref<(Verdict & { model: string; ms: number }) | null>(null)
const pending = ref(false)
const error = ref('')
const showAll = ref(false)

/** Overrides are keyed by the thread they were made on, so reading the same paste twice remembers. */
const override = ref<{ decision: Decision; reason: string } | null>(null)
const overriding = ref<Decision | null>(null)
const reason = ref('')

function loadSample() {
  const s = SAMPLES.find((x) => x.name === sample.value)
  if (!s) return
  thread.value = s.thread
  note.value = s.note ?? ''
  invitePending.value = s.invitePending ?? false
  weAre.value = ''
  ourAsk.value = ''
  result.value = null
  override.value = null
}

const key = (s: string) => `swm:${[...s].reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381)}`
const load = () => {
  try {
    override.value = JSON.parse(localStorage.getItem(key(thread.value)) || 'null')
  } catch {
    override.value = null
  }
}

const final = computed(() => override.value?.decision ?? result.value?.decision ?? null)
const card = computed(() => DECISIONS.find((d) => d.id === final.value))
const nextStep = computed(() => (final.value ? NEXT_STEP[final.value] : ''))

// The model's own words, plus the human's line when they have overridden the call.
const why = computed(() => {
  if (!result.value) return ''
  return override.value ? `${result.value.why} You called it ${override.value.decision}: “${override.value.reason}”.` : result.value.why
})
const shown = computed(() => {
  const all = result.value?.signals ?? []
  return showAll.value ? all : all.slice(0, 5)
})

async function read() {
  pending.value = true
  error.value = ''
  override.value = null
  overriding.value = null
  try {
    result.value = await $fetch('/api/decide', {
      method: 'POST',
      body: { thread: thread.value, weAre: weAre.value, ourAsk: ourAsk.value, note: note.value, invitePending: invitePending.value },
    })
    showAll.value = false
    load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Something went wrong.'
    result.value = null
  } finally {
    pending.value = false
  }
}

function pick(d: Decision) {
  if (!result.value) return
  if (d === final.value) return
  overriding.value = d
  reason.value = ''
}

function saveOverride() {
  if (!overriding.value || !reason.value.trim()) return
  override.value = { decision: overriding.value, reason: reason.value.trim() }
  localStorage.setItem(key(thread.value), JSON.stringify(override.value))
  overriding.value = null
}

function clearOverride() {
  localStorage.removeItem(key(thread.value))
  override.value = null
}

const NEXT_STEP: Record<Decision, string> = {
  meet: 'Offer two times this week. Keep the agenda to the decision they named.',
  async: 'Send the comparison they asked for. Do not attach a calendar hold.',
  wait: 'One check-in on the date they mentioned. No new meeting invite.',
  drop: 'Close the loop politely. Do not offer another slot.',
}
</script>

<template>
  <div class="app">
    <header>
      <div class="brand">
        <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></svg>
        <span>should we meet</span>
      </div>
      <div class="tagline">client context, clearer decisions</div>
    </header>

    <section class="hero">
      <div>
        <h1>Let the thread decide.</h1>
        <p>Before you book time, know if they actually want a meeting, or if we should send something, wait, or stop.</p>
      </div>
      <div class="mono-notes">
        <div>PASTE A THREAD.</div>
        <div>GET A CLEAR SIGNAL.</div>
        <div>SPEND TIME WHERE IT MATTERS.</div>
      </div>
    </section>

    <div class="cols">
      <!-- Left: what the client actually said -->
      <form class="card pane" @submit.prevent="read">
        <div class="pane-head">
          <span class="eyebrow">Thread</span>
          <select v-model="sample" class="samples" aria-label="Load a sample thread" @change="loadSample">
            <option value="">Load a sample…</option>
            <option v-for="s in SAMPLES" :key="s.name" :value="s.name">{{ s.name }}</option>
          </select>
        </div>
        <textarea
          v-model="thread"
          class="thread"
          spellcheck="false"
          placeholder="riley  9:24 am&#10;looks interesting, can you send the one-pager and pricing?"
        />

        <details class="context">
          <summary>
            <svg viewBox="0 0 24 24" width="15" height="15"><path d="M21 11l-9 9a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8" /></svg>
            Add context (optional)
            <span class="chev">⌄</span>
          </summary>
          <label>Who we are <input v-model="weAre" placeholder="Acme, the vendor in this thread"></label>
          <label>What we were going to ask for <input v-model="ourAsk" placeholder="a 30-min scoping call"></label>
          <label>Anything else <input v-model="note" placeholder="it's been 3 weeks"></label>
        </details>

        <label class="check">
          <input v-model="invitePending" type="checkbox">
          They already sent an invite
        </label>

        <button class="go" :disabled="pending || !thread.trim()">
          {{ pending ? 'Reading…' : 'Read the room' }} <span aria-hidden="true">→</span>
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>

      <!-- Right: the call -->
      <section class="card pane">
        <div class="pane-head">
          <span class="eyebrow">Recommendation</span>
          <span v-if="result" class="model"><b>{{ result.ms }} ms</b> · Model: {{ result.model }}</span>
        </div>

        <p v-if="!result" class="empty">Paste a thread and read the room. The call, the evidence behind it, and one next step land here.</p>

        <template v-else>
          <div class="verdict">
            <div>
              <h2 :class="final">{{ card?.title }}</h2>
              <div class="conf">
                <span class="pill" :class="result.confidence.replace(' ', '-')">
                  <i /> {{ result.confidence }}
                </span>
                <span class="pct">{{ Math.round(result.score * 100) }}% confidence</span>
              </div>
              <p class="why">{{ why }}</p>
            </div>

            <div class="next">
              <div class="next-label">Next step</div>
              <div class="next-body">
                <svg viewBox="0 0 24 24" width="17" height="17"><path d="M6 2h7l5 5v15H6zM13 2v5h5M9 13h6M9 17h6" /></svg>
                <p>{{ nextStep }}</p>
              </div>
            </div>
          </div>

          <div class="eyebrow signals-head">Key signals</div>
          <ul class="signals">
            <li v-for="s in shown" :key="s.id">
              <span class="read">
                <span class="q">{{ s.label }}</span>
                <span class="a" :class="{ yes: s.answer === 'Yes', no: s.answer === 'No' }">{{ s.answer }}</span>
              </span>
              <span class="n">{{ Math.round(s.certainty * 100) }}%</span>
              <span class="bar"><i :class="{ weak: s.certainty < 0.6 }" :style="{ width: `${Math.round(s.certainty * 100)}%` }" /></span>
            </li>
          </ul>
          <button v-if="result.signals.length > 5" class="more" @click="showAll = !showAll">
            {{ showAll ? 'Show fewer signals' : `Show all signals (${result.signals.length})` }}
          </button>

          <div v-if="override" class="override-strip">
            Overridden from <b>{{ result.decision }}</b>: “{{ override.reason }}”
            <button @click="clearOverride">undo</button>
          </div>

          <div class="picks">
            <button
              v-for="d in DECISIONS"
              :key="d.id"
              class="pick"
              :class="{ active: d.id === final }"
              @click="pick(d.id)"
            >
              <svg viewBox="0 0 24 24" width="19" height="19"><path :d="d.icon" /></svg>
              <span class="t">{{ d.title }}</span>
              <span class="s">{{ d.sub }}</span>
            </button>
          </div>

          <form v-if="overriding" class="override-form" @submit.prevent="saveOverride">
            <label>Why {{ overriding }} instead? One line.</label>
            <div>
              <input v-model="reason" autofocus placeholder="RFP deadline is Friday">
              <button type="submit" :disabled="!reason.trim()">Save</button>
              <button type="button" class="ghost" @click="overriding = null">Cancel</button>
            </div>
          </form>
        </template>
      </section>
    </div>
  </div>
</template>

<style>
:root {
  --bg: #0a0a0b;
  --card: #0f0f11;
  --line: #24242a;
  --ink: #f2f2f4;
  --dim: #8b8b96;
  --green: #4ade80;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.app { max-width: 1200px; margin: 0 auto; padding: 0 20px 64px; }

header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 12px; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
.tagline { color: var(--dim); font-size: 13.5px; }

.hero { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; padding: 44px 0 28px; }
h1 { font-size: clamp(30px, 5vw, 46px); line-height: 1.05; letter-spacing: -0.035em; margin: 0 0 10px; }
.hero p { color: var(--dim); margin: 0; max-width: 56ch; }
.mono-notes { font: 11.5px/1.75 var(--mono); letter-spacing: 0.09em; color: var(--dim); text-align: right; }

.cols { display: grid; grid-template-columns: 1fr 1.28fr; gap: 20px; align-items: start; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.pane { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.pane-head { display: flex; justify-content: space-between; align-items: center; }
.eyebrow { font: 600 11px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.model { font-size: 12px; color: var(--dim); }
.model b { color: var(--green); font-weight: 500; font-variant-numeric: tabular-nums; }
.samples { background: #0b0b0d; color: var(--dim); border: 1px solid var(--line); border-radius: 8px; padding: 6px 9px; font: inherit; font-size: 12.5px; max-width: 58%; }
.samples:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

.thread {
  min-height: 300px; resize: vertical; width: 100%;
  background: #0b0b0d; color: var(--ink); border: 1px solid var(--line); border-radius: 10px;
  padding: 14px; font: 13.5px/1.7 var(--mono);
}
.thread::placeholder { color: #4a4a54; }
.thread:focus-visible, input:focus-visible, .go:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

.context { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.context summary { display: flex; align-items: center; gap: 10px; cursor: pointer; color: var(--dim); list-style: none; }
.context summary::-webkit-details-marker { display: none; }
.chev { margin-left: auto; }
.context label { display: block; margin-top: 12px; font-size: 12.5px; color: var(--dim); }
input[type="text"], .context input, .override-form input {
  width: 100%; margin-top: 5px; padding: 9px 11px; border-radius: 8px;
  background: #0b0b0d; border: 1px solid var(--line); color: var(--ink); font: inherit; font-size: 14px;
}
.check { display: flex; align-items: center; gap: 11px; color: var(--dim); font-size: 14px; }
.check input { width: 17px; height: 17px; accent-color: var(--green); }

.go {
  padding: 16px; border: 0; border-radius: 11px; background: #fafafa; color: #0a0a0b;
  font: 600 15.5px inherit; cursor: pointer;
}
.go:disabled { opacity: 0.45; cursor: not-allowed; }
.error { color: #fb7185; font-size: 13.5px; margin: 0; }
.empty { color: var(--dim); margin: 0; padding: 40px 0; max-width: 42ch; }

.verdict { display: grid; grid-template-columns: 1fr minmax(0, 300px); gap: 20px; align-items: start; }
h2 { font-size: clamp(40px, 6vw, 62px); letter-spacing: -0.045em; margin: 2px 0 12px; line-height: 1; }
h2.drop { color: #fb7185; }
.conf { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; font-size: 13.5px; text-transform: capitalize; }
.pill i { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
.pill.thin-evidence i { background: #fbbf24; }
.pct { color: var(--green); font-size: 13.5px; }
.why { color: #c9c9d1; margin: 14px 0 0; max-width: 46ch; }

.next { border: 1px solid var(--line); border-radius: 11px; padding: 14px 16px; background: #131316; }
.next-label { font-size: 13.5px; margin-bottom: 10px; }
.next-body { display: flex; gap: 12px; align-items: flex-start; color: var(--dim); }
.next-body p { margin: 0; font-size: 13.5px; color: #c9c9d1; }
.next-body svg { flex: none; margin-top: 2px; }

.signals-head { margin-top: 6px; }
.signals { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.signals li { display: grid; grid-template-columns: minmax(0, 1fr) 44px 150px; gap: 12px; align-items: center; padding: 12px 2px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
/* Question first, the read underneath it: a long rubric label then wraps on its own terms. */
.read { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; min-width: 0; }
.q { color: #c9c9d1; }
.a { padding: 3px 11px; border-radius: 999px; background: #1b1b20; color: var(--dim); font-size: 12.5px; }
.a.yes { background: rgba(74, 222, 128, 0.15); color: var(--green); }
.n { color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }
.bar { background: #1b1b20; border-radius: 999px; height: 7px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--green); border-radius: 999px; }
.bar i.weak { background: #3f3f48; }
.more { background: none; border: 0; color: var(--dim); font: inherit; font-size: 13px; cursor: pointer; padding: 12px; }

.override-strip { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--dim); background: #131316; border: 1px solid var(--line); border-radius: 9px; padding: 10px 13px; }
.override-strip b { color: var(--ink); text-transform: capitalize; font-weight: 600; }
.override-strip button { margin-left: auto; background: none; border: 0; color: var(--green); font: inherit; cursor: pointer; text-decoration: underline; }

.picks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; }
.pick { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 8px; border: 1px solid var(--line); border-radius: 11px; background: transparent; color: var(--ink); cursor: pointer; }
.pick .t { font-weight: 600; font-size: 14.5px; }
.pick .s { color: var(--dim); font-size: 12px; }
.pick:hover { border-color: #3a3a44; }
.pick.active { background: #fafafa; color: #0a0a0b; border-color: #fafafa; }
.pick.active .s { color: #55555f; }

.override-form label { display: block; font-size: 13px; color: var(--dim); margin-bottom: 8px; }
.override-form div { display: flex; gap: 8px; }
.override-form button { padding: 9px 16px; border-radius: 8px; border: 0; background: var(--green); color: #07130c; font: 600 14px inherit; cursor: pointer; }
.override-form .ghost { background: transparent; border: 1px solid var(--line); color: var(--dim); font-weight: 400; }

@media (max-width: 900px) {
  .cols, .verdict { grid-template-columns: 1fr; }
  .picks { grid-template-columns: repeat(2, 1fr); }
  .mono-notes { text-align: left; }
  .signals li { grid-template-columns: minmax(0, 1fr) 44px; }
  .signals .bar { display: none; }
}
</style>
