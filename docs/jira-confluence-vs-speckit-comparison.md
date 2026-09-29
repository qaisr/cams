# JIRA/Confluence Integration: `.claude/` Framework vs. spec-kit Extensions

**Compared:**

- This repo's `.claude/` framework (JIRA + Confluence integration, built into
  `.claude/commands/`, `.claude/agents/`, `scripts/jira/`,
  `scripts/confluence/`)
- `spec-kit-jira` v3.0.0 — `/Users/qaiser.abbas/Dev/aipe/spec-kit/spec-kit-jira`
- `spec-kit-confluence` v1.1.1 —
  `/Users/qaiser.abbas/Dev/aipe/spec-kit/spec-kit-confluence`

**Date:** 2026-08-05

---

## 1. Philosophy

|                     | `.claude/` framework                                                                                                                                                                                                                                                                                                                              | spec-kit extensions                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model**           | Local git-committed **mirror** (`jira/`, `confluence/`) is the source of truth for all planning/implementation commands. Mirror is synced, hashed, diffed, and reconciled through explicit pipelines.                                                                                                                                             | No mirror. Each command (`specstoissues`, `write`/`read`/`update`) talks to the MCP server fresh, every invocation, against whatever the user passes as a URL/project key. |
| **MCP access**      | Hard-gated by policy in root `CLAUDE.md`: live MCP calls are **forbidden** in `/create-specifications`, `/create-epics`, `/implement-epic`, `/add-feature`, and all agents they invoke. Only `/jira*` / `/confluence*` commands, or an explicitly user-approved NL question, may touch MCP — approval is required **per call**, no carry-forward. | No equivalent concept. Any command can call the MCP server at any time; there is no notion of "planning commands must not touch live data."                                |
| **State ownership** | Four explicitly separated state layers (sync manifest, epic roster, derived index, identity cache), each with one writer, governed by rule **R3: ingest ≠ generate ≠ reconcile ≠ push**.                                                                                                                                                          | No persistent state model for Confluence. JIRA extension has one JSON mapping file (`jira-mapping.json`) as its only state.                                                |
| **Design intent**   | Built as **infrastructure**: a reusable sync/mutation substrate other commands (spec generation, epic planning) consume read-only.                                                                                                                                                                                                                | Built as a **thin projection**: spec-kit's own `spec.md`/`tasks.md` artifacts pushed outward, or a single doc synthesized inward. Narrower, single-purpose.                |

---

## 2. Command surface

| Capability                | `.claude/` JIRA                                                | spec-kit-jira                                          | `.claude/` Confluence                                  | spec-kit-confluence            |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------ |
| Router / NL entry point   | `/jira`                                                        | —                                                      | `/confluence`                                          | —                              |
| Bootstrap / init mirror   | `/jira-init`                                                   | —                                                      | (via `pull`)                                           | —                              |
| Field/schema discovery    | `/jira-discover-fields` (name+schema match, never guesses ids) | `/speckit.jira.discover-fields` (heuristic name match) | N/A                                                    | N/A                            |
| Pull / sync from remote   | `/jira-sync` (scoped, batched, diff-based)                     | — (no pull exists)                                     | `/confluence pull`, `/confluence-sync`                 | `read` (best-effort, optional) |
| Push edits back           | `/jira-push` (description-only)                                | `/speckit.jira.sync-status` (status-only, one-way)     | `/confluence push` (section-scoped)                    | `update` (LLM-rephrased merge) |
| Create new item           | `/jira-add-issue`, `/jira-create`                              | `/speckit.jira.specstoissues` (bulk hierarchy)         | `/confluence create`                                   | `write`                        |
| AI-assisted enhancement   | `/jira-enhance` (batched gap-analysis)                         | —                                                      | `/confluence enhance`                                  | (implicit in `write`/`update`) |
| Relationship/link mapping | via write-engine link tables                                   | configurable Epic/Story/Task link types                | `/confluence relationship-map` (JIRA↔Confluence graph) | —                              |
| Comment handling          | pull-only (comments are pull-only region)                      | not supported (explicitly "Planned")                   | `/confluence comment-triage` (classify, digest)        | not supported                  |
| Doc-vs-code drift         | —                                                              | —                                                      | `/confluence design-sync`                              | —                              |
| Read-only analytics       | `/jira` sub-verbs: `search/sprint/backlog/who/gap/map`         | —                                                      | `/confluence` sub-verbs: `space/who/tree/gap/stale`    | —                              |
| Batch worker for scale    | `jira-pull-batch` (Haiku subagent, JSON-only return)           | —                                                      | `confluence-pull-batch` (same pattern)                 | —                              |

**Observation:** the `.claude/` framework has roughly 3-4x the command surface
on each side, largely because it treats sync, discovery, creation, enhancement,
and relationship-mapping as separate composable verbs, whereas spec-kit bundles
everything into 3 commands per tracker.

---

## 3. Sync model, conflict handling, and scale

| Dimension                      | `.claude/` framework                                                                                                                                                                                                                                           | spec-kit extensions                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local mirror**               | Yes — full mirror with sidecars, manifest, derived index (`_index.json`), gitignored/regenerated separately from committed sync state                                                                                                                          | JIRA: one mapping file only. Confluence: none.                                                                                                                                                                                                                                |
| **Bidirectional sync**         | Yes, both trackers — pull and push are distinct, hash-gated, status-tracked (`clean/remote-ahead/local-ahead/diverged/new/orphaned`)                                                                                                                           | JIRA: create + status-push only, **no pull at all** (explicitly listed as unimplemented in CHANGELOG). Confluence: `write`+`update` (push) and `read` (soft pull), no diff/status model.                                                                                      |
| **Conflict resolution**        | Dual content-hash + live `version` re-check before every mutation ("lost-update guard"); divergence **STOPs** and shows a 3-way diff; never blind-overwrites                                                                                                   | None. JIRA: re-running create makes duplicates unless the user manually manages the mapping file. Confluence: `update` re-synthesizes from whatever is currently live, no prior-state diff, no divergence detection.                                                          |
| **Staleness detection**        | Explicit `stalenessHours: 24` config, drives mirror-vs-live decision rule                                                                                                                                                                                      | Not modeled — no concept of "fresh" vs "stale" data.                                                                                                                                                                                                                          |
| **Batching at scale**          | Deterministic partitioner (`plan-batches.ts`, shared by both trackers) — triggers above `largeSyncThreshold` (15), splits by epic/ancestor-branch, caps batch size (`maxBatchPages`: 8), spawns isolated subagent workers that return only compact JSON counts | None on either side. spec-kit-jira explicitly issues one sequential MCP call per issue with no chunking/throttling — documented as creating 90+ sequential calls for a 94-task spec. spec-kit-confluence operates on exactly one page per call; no multi-page concept exists. |
| **Idempotency / crash safety** | SHA-256 intent records (`.push-runs/`) prevent duplicate creates/writes on retry; explicitly designed to make a repeated run a no-op                                                                                                                           | JIRA: `sync-status` is idempotent for status-push; `specstoissues` is **not** idempotent (duplicate risk on re-run). Confluence: no idempotency guarantee documented for any command.                                                                                         |

---

## 4. Governance and approval gates

|                           | `.claude/` framework                                                                                                                                                                                                 | spec-kit extensions                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mutation pipeline**     | Both trackers route every write through the same 8-step engine: Diff/Draft → Dry-run → **human Apply per change** → live version re-check → Mutate → Re-pull → Reconcile mirror → Suggest (never auto-run) follow-up | No dry-run, no per-change approval step, no formal pipeline. JIRA extension's only gate is a yes/no hook prompt before auto-running `specstoissues` after `/speckit.tasks`. Confluence extension has zero gates — `write`/`update` mutate immediately.                                                                                          |
| **Write scope limits**    | JIRA: description-only (no status/label/link mutation via push). Confluence: section-scoped — macros, Comments, Metadata are explicitly inviolate; engine stops rather than rewriting them.                          | JIRA: full issue creation + status transitions (broader write scope, no equivalent restriction). Confluence: no documented scope restriction — `update` can, per its own description, add/revise/remove any part of the page.                                                                                                                   |
| **Human decision points** | Parent-epic placement is always human-picked (never auto-inferred); glossary term writes require explicit confirmation.                                                                                              | None documented — Jira extension does prompt "skip existing / re-create all / abort" when a mapping file already exists, which is the closest analogue.                                                                                                                                                                                         |
| **Auth/secrets handling** | Delegates entirely to the Atlassian MCP session; no tokens handled by framework code.                                                                                                                                | JIRA: same, delegated to MCP config. Confluence: `setup_mcp.sh` collects and writes a broad-scope GitHub PAT into global IDE MCP config as part of the same setup flow, and backs up prior `mcp.json` content (which may include secrets) into a **plaintext log file** — a governance smell absent from every other integration compared here. |

---

## 5. Content fidelity

|                      | `.claude/` JIRA                                                                                                                       | spec-kit-jira                                                                                                                               | `.claude/` Confluence                                                                                                                           | spec-kit-confluence                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Field mapping        | Resolves real custom-field ids by name+schema match (sprint, story points, epic link, rank), confirms epic-link strategy via live JQL | Heuristic name-matching only; explicit caveat that field ids are stable but names vary by instance                                          | N/A                                                                                                                                             | N/A                                                                              |
| Body format          | Markdown mirror is a known-lossy simplification of ADF (explicit, accepted trade-off)                                                 | Raw markdown truncated into `description`, no ADF handling described                                                                        | Confluence API returns Markdown directly (`contentFormat:"markdown"`); unconvertible macros fenced as opaque blocks and preserved byte-for-byte | Undocumented — no mention of ADF/storage-format/macros anywhere in the extension |
| Attachments/images   | Tracked under `confluence/attachments/{id}/`                                                                                          | Not supported (explicit "Planned" gap)                                                                                                      | Tracked explicitly                                                                                                                              | Not supported/undocumented                                                       |
| Relationship/linking | Configurable link-type tables per relationship (parent/epic-link/relates/blocks)                                                      | Same idea — configurable per-relationship link types (2-level and 3-level hierarchy modes) — this is spec-kit-jira's most developed feature | Full bipartite JIRA↔Confluence graph with typed edges, gap detection, Mermaid rendering                                                         | None                                                                             |

---

## 6. Maturity and scope signals

- **spec-kit-jira** is the more mature of the two spec-kit extensions: versioned
  to 3.0.0, three breaking revisions, an honest CHANGELOG "Planned" list (bi-di
  sync, bulk updates, attachments, comments, sprint assignment — 7 items), and
  real config-driven relationship typing. Its scope is intentionally narrow:
  project spec-kit's own two artifacts into an issue tree, one-way.
- **spec-kit-confluence** is early and thin: v1.1.1, three commands, no roadmap,
  no documented content-conversion behavior, and a setup script with a real
  security smell (plaintext secret backup, broad-scope PAT collection bundled
  into an unrelated Confluence setup flow).
- The **`.claude/` framework** treats both integrations as one shared substrate
  (same `write-engine`, same `plan-batches.ts` partitioner, same
  manifest/hash/reconcile pattern applied to both trackers) rather than two
  independently-scoped extensions. This buys consistency and scale-handling
  neither spec-kit extension has, at the cost of being repo-specific rather than
  a portable, independently-versioned package.

---

## 7. Conclusion

The `.claude/` framework's JIRA/Confluence integration is a **substantially more
complete system** than either spec-kit extension, on nearly every axis that
matters for sustained, team-scale use:

1. **It is the only one of the three with real bidirectional sync.**
   spec-kit-jira has no pull path at all (an acknowledged gap);
   spec-kit-confluence's "pull" (`read`) is a best-effort, non-deterministic LLM
   summarization, not a structured sync.
2. **It is the only one with conflict safety.** Version re-checks and hash-based
   divergence detection prevent lost updates on both trackers; both spec-kit
   extensions either risk duplicate creation (JIRA) or silently re-synthesize
   over unknown prior state (Confluence).
3. **It is the only one designed for scale.** The shared batch-planning module
   handles large epics/spaces deterministically with bounded, isolated workers;
   both spec-kit extensions make unbounded sequential calls with no chunking.
4. **It is the only one with a formal governance pipeline.** Every mutation
   passes through dry-run → human-approve → re-check → mutate → reconcile;
   spec-kit-confluence has no gate at all, and spec-kit-jira's only gate is a
   single yes/no hook prompt.
5. **It correctly separates planning-time reads from live-write operations** via
   the MCP access-control policy — a concept that doesn't exist in either
   spec-kit extension, where any command can hit the live API at any time.

Where **spec-kit-jira** wins is relationship-type configurability for issue
hierarchies (Epic/Story/Task with pluggable link semantics) — a narrow feature
the `.claude/` framework's write-engine covers similarly but less explicitly
documented — and its honest, itemized roadmap of known gaps.
**spec-kit-confluence** has no comparable strength; its core "AI synthesizes a
doc" idea is present in `.claude/`'s `confluence-enhance` and
`confluence-create` but implemented with far more content-fidelity discipline
(section-scoped edits, macro preservation) than spec-kit-confluence's
undocumented "rephrase and merge" approach.

**Bottom line:** the two spec-kit extensions are single-purpose,
artifact-projection tools bolted onto spec-kit's own workflow, with no shared
infrastructure between them and no sync-safety model. The `.claude/` framework's
integration is a shared, hardened sync/mutation substrate — mirror-first,
hash-verified, batch-safe, and governance-gated — that both JIRA and Confluence
commands (and the higher-level spec/epic pipeline that must _not_ touch them)
build on. For any team running at ticket/page volumes beyond a handful, or
needing to trust that automated writes won't silently clobber concurrent human
edits, the `.claude/` framework's model is the safer and more scalable design.
