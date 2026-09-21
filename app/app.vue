<template>
  <div class="app">
    <header>
      <div class="brand">
        <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></svg>
        <span>ops copilots</span>
      </div>
      <nav class="tools">
        <NuxtLink to="/">should we meet</NuxtLink>
        <NuxtLink to="/who-is-this">who is this</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
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
.tools { display: flex; gap: 18px; font-size: 13.5px; }
.tools a { color: var(--dim); text-decoration: none; }
.tools a.router-link-active { color: var(--ink); }
.tools a:hover { color: var(--ink); }

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

h2 { font-size: clamp(40px, 6vw, 62px); letter-spacing: -0.045em; margin: 2px 0 12px; line-height: 1; }
h2.none { color: #fb7185; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; font-size: 13.5px; text-transform: capitalize; }
.pill i { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
.pill.thin-evidence i, .pill.thin i { background: #fbbf24; }
.pill.leaning i { background: #fbbf24; }

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

.override-form label { display: block; font-size: 13px; color: var(--dim); margin-bottom: 8px; }
.override-form div { display: flex; gap: 8px; flex-wrap: wrap; }
.override-form button { padding: 9px 16px; border-radius: 8px; border: 0; background: var(--green); color: #07130c; font: 600 14px inherit; cursor: pointer; }
.override-form .ghost { background: transparent; border: 1px solid var(--line); color: var(--dim); font-weight: 400; }

@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  .signals li { grid-template-columns: minmax(0, 1fr) 44px; }
  .signals .bar { display: none; }
}
</style>
