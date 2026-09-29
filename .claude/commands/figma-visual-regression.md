---
description: Visual-regression a built screen against its Figma mirror baseline (.png), guarded by renderHash staleness (BD6)
argument-hint: "[<slug>]  (omit to run all manifest entries)"
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# /figma-visual-regression `[<slug>]`

Compare a **built screen** (rendered live via Playwright) against its **Figma mirror
baseline `.png`**, within a per-entry pixel threshold — but only when the baseline is
still trustworthy. If no `<slug>` is given, run every entry in the manifest.

> **BD6 / BD9.** The baseline is the node's committed mirror `.png`; the diff reads the
> **mirror only** and runs Playwright. **No MCP** in this command or in CI. A single MCP
> touch (`/figma pull`) is needed **only** to refresh a stale baseline, and that is a
> separate, human-invoked, local-dev-only step — never automatic, never in this path.

---

## State on disk

| Path | Role | Committed? |
|---|---|---|
| `figma/.visual-regression/manifest.json` | Entries: `slug/nodeId/route/threshold/baselineRenderHash/lastResult`. | Yes |
| `figma/nodes/<slug>.meta.json` | Node sidecar carrying the **current** `renderHash`. | Yes |
| `figma/nodes/<slug>.png` (mirror render) | The **baseline** image the shot is diffed against. | Yes |
| `scripts/figma/visual-regression.ts` | Pure staleness + diff-verdict core (`--selftest`). | Yes |
| `scripts/figma/hash.ts` | `renderHash` semantics (`sha256:` byte hash). | Yes |
| Playwright shot + diff artifacts | Throwaway run output. | No (gitignored) |

Node id: **colon form in JSON** (`299:12210`), hyphen form only in Figma URLs (D5).

---

## Flow

1. **SELECT** — load `manifest.json`. For `<slug>` pick that entry; otherwise iterate all.
   Empty manifest → report "no screens under visual regression yet" and STOP.
2. **STALENESS GUARD (first, always)** — read the node's current `renderHash` from
   `figma/nodes/<slug>.meta.json` and compare it to the entry's `baselineRenderHash`
   via `stalenessVerdict()`. **If stale → REFUSE the diff** for that entry: report that
   the mirror `.png` has moved on and instruct the user to run `/figma pull` (MCP, local
   dev only) then refresh the baseline. Do not run Playwright for a stale entry.
3. **CAPTURE** — for fresh entries, start the app if needed (respect the runtime
   diagnostics policy: this-repo dev ports only) and take a Playwright screenshot of
   `entry.route`, sized to the baseline `.png`.
4. **DIFF** — compute a pixel `diffRatio` (0..1) between the shot and the baseline `.png`
   (e.g. `pixelmatch`/`odiff`). Feed the ratio + `entry.threshold` to `diffVerdict()`.
5. **EVALUATE** — `evaluateEntry()` combines staleness + diff into `pass | fail | stale`.
6. **WRITE BACK** — update the entry's `lastResult` (`status`, `diffRatio`, `ranAt` — use
   the real clock) in `manifest.json`. This is code-side state only; the **canvas is never
   touched** (D15). Never rewrite `baselineRenderHash` here — refreshing the baseline is a
   deliberate human step after a `/figma pull`.
7. **REPORT** — per entry: slug, status, diffRatio vs threshold (or the stale reason).

---

## Adding a screen to the manifest
When a hi-fi screen is first built and mapped to a Figma node, add an entry:
```json
{
  "slug": "entity-onboarding-confirm",
  "nodeId": "299:12210",
  "route": "/onboarding/confirm",
  "threshold": 0.02,
  "baselineRenderHash": "sha256:…",   // copy the node's current renderHash from its .meta.json
  "lastResult": null
}
```
`baselineRenderHash` MUST match the node's `renderHash` at the moment you accept the
mirror `.png` as the baseline — that equality is exactly what the staleness guard checks.

---

## Offline proof
```bash
tsx scripts/figma/visual-regression.ts --selftest
# proves: equal hash → trust, unequal hash → stale, diffRatio ≤/> threshold → pass/fail. Exits 0.
```
No MCP anywhere in the diff path.
