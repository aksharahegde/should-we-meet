<script setup lang="ts">
import type { MatchResult } from '../../server/utils/match'
import { WHO_SAMPLES } from '../who-is-this-samples'

type FieldResult = (MatchResult & { model: string; ms: number }) | null

/** The other three fields on the "invoice", fixed demo data — only Customer is chip-driven. */
const CLASS = { kind: 'class', label: 'Class', extracted: '142 Danny Osei', candidates: 'Route 142 · Danny Osei | 142\nRoute 118 · Priya Nair | 118\nRoute 205 · Unassigned | 205' }
const REP = { kind: 'rep', label: 'Rep', extracted: 'DO', candidates: 'Danny Osei | DO\nDana Ortiz | DO\nFelix Marsh | FM' }
const SUPPLIER = { kind: 'supplier', label: 'Supplier (VIA)', extracted: 'VALSTAR PETRO', candidates: 'Valstar Petroleum Inc. | Valstar Petro\nAnchorlight Fuels LLC\nBrightwell Energy Co.' }

const extracted = ref(WHO_SAMPLES[0]!.extracted)
const candidatesRaw = ref(WHO_SAMPLES[0]!.candidates)

const results = reactive<{ customer: FieldResult; class: FieldResult; rep: FieldResult; supplier: FieldResult }>({
  customer: null,
  class: null,
  rep: null,
  supplier: null,
})
const pending = ref(false)
const error = ref('')

function loadSample(s: (typeof WHO_SAMPLES)[number]) {
  extracted.value = s.extracted
  candidatesRaw.value = s.candidates
  results.customer = null
}

/** Same dedupe rule as the server's `parseCandidates`, just counting for the button and hint. */
const candidateCount = computed(() => {
  const seen = new Set<string>()
  for (const line of candidatesRaw.value.split('\n')) {
    const legal = line.trim().split('|')[0]!.trim()
    if (legal) seen.add(legal.toLowerCase())
  }
  return seen.size
})

const hint = computed(() => {
  if (!extracted.value.trim()) return 'paste the name as extracted'
  if (candidateCount.value < 2) return 'add at least two possible matches'
  if (candidateCount.value > 12) return 'too many options for this demo. keep it to 12.'
  return ''
})

async function runAll() {
  if (hint.value) return
  pending.value = true
  error.value = ''

  const jobs: { key: keyof typeof results; extracted: string; candidates: string; kind: string }[] = [
    { key: 'customer', extracted: extracted.value, candidates: candidatesRaw.value, kind: 'customer' },
    { key: 'class', extracted: CLASS.extracted, candidates: CLASS.candidates, kind: CLASS.kind },
    { key: 'rep', extracted: REP.extracted, candidates: REP.candidates, kind: REP.kind },
    { key: 'supplier', extracted: SUPPLIER.extracted, candidates: SUPPLIER.candidates, kind: SUPPLIER.kind },
  ]

  const settled = await Promise.all(jobs.map(async (job) => {
    try {
      const r = await $fetch<FieldResult>('/api/match', { method: 'POST', body: job })
      return { key: job.key, r, err: null as string | null }
    } catch (e: any) {
      return { key: job.key, r: null as FieldResult, err: e?.data?.statusMessage || e?.message || 'could not match' }
    }
  }))

  for (const s of settled) {
    results[s.key] = s.r
    if (s.err && !error.value) error.value = s.err
  }
  pending.value = false
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <h1>who is this</h1>
        <p>from a messy extract, return the legal name on the list</p>
      </div>
    </section>

    <div class="chips">
      <button v-for="s in WHO_SAMPLES" :key="s.name" type="button" class="chip" @click="loadSample(s)">{{ s.name }}</button>
    </div>

    <div class="stage">
      <div class="mock">
        <!-- Left: the "uploaded" document, rendered as plain HTML — no PDF involved -->
        <div class="left-col">
          <div class="pdf-frame">
            <div class="pdf-page">
              <div class="pdf-head">
                <div>
                  <div class="pdf-brand">NORTHBOUND LOGISTICS</div>
                  <div class="pdf-sub">Bill of Lading</div>
                </div>
                <div class="pdf-meta">
                  <div>BOL #4471-A</div>
                  <div>Rev. 3</div>
                </div>
              </div>
              <div class="pdf-rule" />
              <div class="pdf-block">
                <div class="pdf-label">Ship To</div>
                <div class="pdf-value">{{ extracted || '—' }}</div>
              </div>
              <div class="pdf-block">
                <div class="pdf-label">Carrier / Rep</div>
                <div class="pdf-value">{{ CLASS.extracted }} · {{ REP.extracted }}</div>
              </div>
              <table class="pdf-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Weight</th></tr></thead>
                <tbody>
                  <tr><td>Palletized freight</td><td>12</td><td>9,400 lb</td></tr>
                  <tr><td>Dry goods, misc.</td><td>4</td><td>1,120 lb</td></tr>
                </tbody>
              </table>
              <div class="pdf-block">
                <div class="pdf-label">Supplier (VIA)</div>
                <div class="pdf-value">{{ SUPPLIER.extracted }}</div>
              </div>
              <div class="pdf-sign">
                <div><span class="pdf-line" /> Shipper</div>
                <div><span class="pdf-line" /> Consignee</div>
              </div>
            </div>
          </div>

          <button type="button" class="go" :disabled="pending || !!hint" @click="runAll">
            {{ pending ? 'matching…' : 'match extracted fields →' }}
          </button>
          <p v-if="hint" class="hint">{{ hint }}</p>
          <p v-if="error" class="validation warn">{{ error }}</p>
        </div>

        <!-- Right: the extraction form, styled after the production screen -->
        <div class="form-panel">
          <div class="section-label">CUSTOMER</div>
          <MatchField label="Customer" noun="customer" :extracted="extracted" :result="results.customer" :pending="pending" />

          <details class="section" open>
            <summary>Load / Trip Details <span class="chev">⌄</span></summary>

            <MatchField label="Class" noun="class" :extracted="CLASS.extracted" :result="results.class" :pending="pending" />
            <MatchField label="Rep" noun="rep" :extracted="REP.extracted" :result="results.rep" :pending="pending" />
            <MatchField label="Supplier (VIA)" noun="supplier" :extracted="SUPPLIER.extracted" :result="results.supplier" :pending="pending" />

            <div class="field">
              <label>Bol Number <i class="dot ok" /></label>
              <input class="filled" value="BOL-88213" readonly>
            </div>

            <div class="field">
              <label>S.O. Number <i class="dot ok" /> <span class="count">0/25</span></label>
              <input placeholder="">
            </div>

            <div class="field">
              <label>Split Location <i class="dot bad" /> <span class="count">0/29</span></label>
              <input class="required-empty" placeholder="">
            </div>
          </details>

          <details class="section">
            <summary>Edit customer inputs <span class="chev">⌄</span></summary>
            <label class="edit-label">extracted name
              <input v-model="extracted" type="text" placeholder="e.g. northlne freight traders">
            </label>
            <label class="edit-label">possible matches
              <textarea
                v-model="candidatesRaw"
                spellcheck="false"
                placeholder="Northline Freight Pte. Ltd. | Northline&#10;Kite & Co. International Ltd. | Kite & Co"
              />
            </label>
            <p v-if="hint" class="hint">{{ hint }}</p>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.hero { padding: 44px 0 20px; }
.hero p { color: var(--dim); margin: 0; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 24px; }
.chip { background: transparent; border: 1px solid var(--line); color: var(--dim); border-radius: 999px; padding: 7px 13px; font: inherit; font-size: 12.5px; cursor: pointer; }
.chip:hover { color: var(--ink); border-color: #3a3a44; }

/* A light "device" staged on the dark app chrome, matching the production screenshot's palette. */
.stage {
  --paper: #fbfaf7; --ink2: #2a2723; --dim2: #85807a; --line2: #ddd8d0;
  --warn: #c9791b; --warn-bg: #fbeee0; --ok: #2f7d4f; --highlight: #f3d99a; --bad: #d0453a;
  background: #050506; border: 1px solid var(--line); border-radius: 16px; padding: 28px; margin-bottom: 40px;
}
.mock { display: grid; grid-template-columns: minmax(0, 340px) 1fr; gap: 24px; align-items: start; }

.left-col { display: flex; flex-direction: column; gap: 12px; }
.pdf-frame { background: var(--paper); border-radius: 18px; padding: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
.pdf-page { border: 1px solid var(--line2); border-radius: 10px; padding: 18px; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink2); background: #fff; }
.pdf-head { display: flex; justify-content: space-between; align-items: flex-start; }
.pdf-brand { font-weight: 700; letter-spacing: 0.02em; font-size: 13px; }
.pdf-sub { color: var(--dim2); font-size: 11.5px; margin-top: 2px; }
.pdf-meta { text-align: right; color: var(--dim2); font-size: 11px; }
.pdf-rule { border-top: 1px solid var(--line2); margin: 12px 0; }
.pdf-block { margin-bottom: 12px; }
.pdf-label { color: var(--dim2); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
.pdf-value { margin-top: 2px; }
.pdf-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11.5px; }
.pdf-table th, .pdf-table td { border-bottom: 1px solid var(--line2); padding: 5px 4px; text-align: left; }
.pdf-table th { color: var(--dim2); font-weight: 500; }
.pdf-sign { display: flex; gap: 24px; margin-top: 22px; font-size: 11px; color: var(--dim2); }
.pdf-sign .pdf-line { display: block; width: 100px; border-top: 1px solid var(--line2); margin-bottom: 4px; }

.left-col .go {
  padding: 13px; border: 0; border-radius: 10px; background: var(--paper); color: var(--ink2);
  font: 600 14px inherit; cursor: pointer;
}
.left-col .go:disabled { opacity: 0.45; cursor: not-allowed; }
.left-col .hint, .left-col .validation { color: var(--dim); }

.form-panel { background: var(--paper); border-radius: 14px; padding: 22px 24px; color: var(--ink2); font-size: 13.5px; }
.section-label { font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.1em; color: var(--dim2); margin-bottom: 10px; }

.section { border-top: 1px solid var(--line2); margin-top: 16px; padding-top: 14px; }
.section summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none; font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim2); }
.section summary::-webkit-details-marker { display: none; }
.section .chev { margin-left: auto; font-family: initial; text-transform: none; }

.field { margin-top: 16px; }
.field label { display: flex; align-items: center; gap: 6px; font-size: 13.5px; margin-bottom: 6px; }
.field .count { color: var(--dim2); font-size: 11.5px; margin-left: auto; }
.field .dot { width: 6px; height: 6px; border-radius: 50%; }
.field .dot.ok { background: var(--ok); }
.field .dot.bad { background: var(--bad); }
.field input { width: 100%; padding: 10px 12px; border-radius: 7px; border: 1px solid var(--line2); background: #fff; font: inherit; font-size: 13.5px; color: var(--ink2); }
.field input.filled { border: 2px solid var(--highlight); background: #fffaef; }
.field input.required-empty { border-color: var(--bad); background: #fdf1f0; }
.field input[readonly] { color: var(--ink2); }

.edit-label { display: block; font-size: 12.5px; color: var(--dim2); margin-top: 12px; }
.edit-label input, .edit-label textarea {
  width: 100%; margin-top: 5px; padding: 9px 11px; border-radius: 7px; border: 1px solid var(--line2);
  background: #fff; color: var(--ink2); font: 13px/1.5 inherit;
}
.edit-label textarea { min-height: 110px; resize: vertical; font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
.hint { color: var(--dim2); font-size: 12.5px; margin: 8px 0 0; }

@media (max-width: 820px) {
  .mock { grid-template-columns: 1fr; }
  .pdf-frame { max-width: 340px; margin: 0 auto; }
}
</style>
