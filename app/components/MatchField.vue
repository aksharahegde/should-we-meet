<script setup lang="ts">
import type { MatchResult } from '../../server/utils/match'

type FieldResult = (MatchResult & { model: string; ms: number }) | null

const props = defineProps<{
  label: string
  /** Lowercase noun used in placeholders and copy, e.g. "customer", "class", "rep". */
  noun: string
  extracted: string
  result: FieldResult
  pending: boolean
}>()

const showBreakdown = ref(false)
const override = ref<{ legalName: string | null; reason: string } | null>(null)
const overriding = ref<{ legalName: string | null } | null>(null)
const overrideReason = ref('')

// A fresh match result means a fresh call — any prior override on this field no longer applies.
watch(() => props.result, () => {
  override.value = null
  overriding.value = null
  showBreakdown.value = false
})

const final = computed(() => (override.value ? override.value.legalName : (props.result?.legalName ?? null)))
const finalShortName = computed(() => {
  if (!props.result) return undefined
  if (!override.value) return props.result.shortName
  return props.result.scores.find((s) => s.label === override.value!.legalName)?.shortName
})
const confirmed = computed(() => !!override.value || props.result?.confidence === 'clear')

const why = computed(() => {
  if (!props.result) return ''
  return override.value
    ? `${props.result.why} We disagreed: “${override.value.reason}”.`
    : props.result.why
})

/** The one-line read under the field, in the app's own QuickBooks-sync voice. */
const message = computed(() => {
  if (!props.result) return { text: '', tone: 'idle' as const }
  if (final.value === null) return { text: `No matching ${props.noun}. Select one to enable QuickBooks sync`, tone: 'warn' as const }
  if (confirmed.value) return { text: 'Matched — synced to QuickBooks', tone: 'ok' as const }
  return { text: 'Low-confidence match. Confirm to enable QuickBooks sync', tone: 'warn' as const }
})

function pick(legalName: string | null) {
  if (!props.result) return
  if (legalName === final.value) return
  overriding.value = { legalName }
  overrideReason.value = ''
}

function saveOverride() {
  if (!overriding.value || !overrideReason.value.trim()) return
  override.value = { legalName: overriding.value.legalName, reason: overrideReason.value.trim() }
  overriding.value = null
}

function clearOverride() {
  override.value = null
}
</script>

<template>
  <div class="match-field">
    <label class="field-label">{{ label }}</label>
    <button
      type="button"
      class="customer-select"
      :class="pending ? 'idle' : message.tone"
      :disabled="!result"
      @click="showBreakdown = !showBreakdown"
    >
      <span>{{ pending ? '…' : (final ?? `Select a ${noun}`) }}</span>
      <span v-if="pending" class="spinner" />
      <svg v-else viewBox="0 0 24 24" width="15" height="15"><path d="M7 9l5 5 5-5" /></svg>
    </button>
    <p v-if="finalShortName" class="extracted-line short">also known as {{ finalShortName }}</p>
    <p class="extracted-line">Extracted: {{ extracted || '—' }}</p>
    <p v-if="message.text && !pending" class="validation" :class="message.tone">{{ message.text }}</p>

    <div v-if="showBreakdown && result" class="breakdown">
      <p class="why">{{ why }}</p>

      <ul class="signals">
        <li v-for="s in result.scores" :key="s.label">
          <span class="read">
            <span class="q">{{ s.label }}</span>
            <span v-if="s.shortName" class="short-muted">{{ s.shortName }}</span>
          </span>
          <span class="n">{{ Math.round(s.pct * 100) }}%</span>
          <span class="bar"><i :class="{ weak: s.pct < 0.4 }" :style="{ width: `${Math.round(s.pct * 100)}%` }" /></span>
        </li>
      </ul>

      <div v-if="override" class="override-strip">
        model said <b>{{ result.legalName ?? 'none of these' }}</b>: “{{ override.reason }}”
        <button type="button" @click="clearOverride">undo</button>
      </div>

      <div class="picks">
        <button
          v-for="s in result.scores.filter((s) => !s.isNone)"
          :key="s.label"
          class="pick"
          :class="{ active: s.label === final }"
          type="button"
          @click="pick(s.label)"
        >
          <span class="t">{{ s.label }}</span>
          <span v-if="s.shortName" class="s">{{ s.shortName }}</span>
        </button>
        <button class="pick" :class="{ active: final === null }" type="button" @click="pick(null)">
          <span class="t">none of these</span>
        </button>
      </div>

      <form v-if="overriding" class="override-form" @submit.prevent="saveOverride">
        <label>why we disagree. One line.</label>
        <div>
          <input v-model="overrideReason" autofocus placeholder="short name only matches a sister option">
          <button type="submit" :disabled="!overrideReason.trim()">use override</button>
          <button type="button" class="ghost" @click="overriding = null">keep result</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
.match-field + .match-field { margin-top: 18px; }
.field-label { display: block; font-size: 13.5px; margin-bottom: 6px; }

.customer-select {
  width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 11px 13px; border-radius: 8px; border: 1px solid var(--line2); background: #fff; color: var(--ink2);
  font: inherit; font-size: 14px; text-align: left; cursor: pointer;
}
.customer-select.warn { border-color: var(--warn); color: var(--warn); }
.customer-select.ok { border-color: var(--line2); }
.customer-select.idle { color: var(--dim2); }
.customer-select:disabled { cursor: default; opacity: 0.7; }
.extracted-line { color: var(--dim2); font-size: 12.5px; margin: 7px 0 0; }
.validation { font-size: 12.5px; margin: 6px 0 0; }
.validation.warn { color: var(--warn); }
.validation.ok { color: var(--ok); }

.spinner {
  width: 13px; height: 13px; border-radius: 50%; flex: none;
  border: 2px solid var(--line2); border-top-color: var(--ink2);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.breakdown { border: 1px solid var(--line2); border-radius: 10px; padding: 14px; margin: 14px 0; background: #fff; }
.breakdown .why { color: var(--ink2); margin: 0 0 10px; font-size: 13px; }
.breakdown .signals { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line2); }
.breakdown .signals li { display: grid; grid-template-columns: minmax(0, 1fr) 40px 110px; gap: 10px; align-items: center; padding: 9px 2px; border-bottom: 1px solid var(--line2); font-size: 12.5px; }
.breakdown .read { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.breakdown .q { color: var(--ink2); }
.breakdown .short-muted { color: var(--dim2); font-size: 11.5px; }
.breakdown .n { color: var(--dim2); text-align: right; font-variant-numeric: tabular-nums; }
.breakdown .bar { background: #ece8e0; border-radius: 999px; height: 6px; overflow: hidden; }
.breakdown .bar i { display: block; height: 100%; background: var(--ok); border-radius: 999px; }
.breakdown .bar i.weak { background: #cfc9bd; }

.breakdown .override-strip { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--dim2); background: #f4f1ea; border: 1px solid var(--line2); border-radius: 8px; padding: 8px 11px; margin-top: 10px; }
.breakdown .override-strip b { color: var(--ink2); font-weight: 600; }
.breakdown .override-strip button { margin-left: auto; background: none; border: 0; color: var(--ok); font: inherit; cursor: pointer; text-decoration: underline; }

.breakdown .picks { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-top: 10px; }
.breakdown .pick { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 9px 11px; border: 1px solid var(--line2); border-radius: 8px; background: #fff; color: var(--ink2); cursor: pointer; }
.breakdown .pick .t { font-weight: 600; font-size: 12.5px; }
.breakdown .pick .s { color: var(--dim2); font-size: 11px; }
.breakdown .pick.active { background: var(--ink2); color: #fff; border-color: var(--ink2); }
.breakdown .pick.active .s { color: #cfc9bd; }

.breakdown .override-form { margin-top: 10px; }
.breakdown .override-form label { display: block; font-size: 12px; color: var(--dim2); margin-bottom: 6px; }
.breakdown .override-form div { display: flex; gap: 6px; flex-wrap: wrap; }
.breakdown .override-form input { flex: 1; min-width: 160px; padding: 8px 10px; border-radius: 7px; border: 1px solid var(--line2); font: inherit; font-size: 13px; }
.breakdown .override-form button { padding: 8px 12px; border-radius: 7px; border: 0; background: var(--ok); color: #fff; font: 600 12.5px inherit; cursor: pointer; }
.breakdown .override-form .ghost { background: transparent; border: 1px solid var(--line2); color: var(--dim2); font-weight: 400; }
</style>
