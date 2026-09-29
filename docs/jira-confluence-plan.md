# Integrating JIRA & Confluence into the CANS AI Framework

> **Status:** Plan / proposal — not yet implemented. **Author:** Brainstorming
> session, 2026-07-29. **Reviewed & corrected:** 2026-07-29 — every claim was
> verified against the live `.claude/` framework files and the live EON/SEC
> Atlassian environment (Atlassian MCP). Verified corrections are now folded
> directly into the text below; this is the reconciled plan, not the original
> draft plus rebuttals. **Scope:** Extend the existing `.claude/` spec-driven
> framework so that requirements can be **ingested from JIRA and Confluence**,
> kept **in sync** as those sources change, and (optionally) **pushed back to
> JIRA** — without violating the framework's sensitive-data governance and while
> staying **token-efficient**.
>
> **Figma + the DaisyUI→Lumen UI migration are deliberately OUT of scope here.**
> They are a larger, self-contained track with a different blast radius, planned
> separately in **[`docs/lumen-figma-plan.md`](./lumen-figma-plan.md)** so it
> can be run as a completely independent Claude session. This plan (JIRA +
> Confluence) ships full value with **zero dependency** on that track.

---

## 1. Context & Problem Statement

### 1.1 Where we are today

The framework already does spec-driven, AI-only development well:

```text
raw requirements (.md/.txt/.csv/...)
  → /create-specifications  → specs/business-requirements.md + specs/functional-specifications.md
  → /create-epics           → specs/epics/0-epics-index.md + epic files
  → /implement-epic          (S/M)   → code + tests
  → /create-epic-tasks + task execution (L/XL)
  → /reconcile-requirements  (mid-workflow drift management)
```

These commands work. **The gap is the front door**: requirements do not
originate as tidy Markdown files in the repo. On this project:

- **Confluence is the source of truth for documents / project information.**
- **JIRA is the source of truth for epics / tasks / stories / bugs.**
- **Most of the team is non-technical** and does not use this repo. They live in
  Confluence and JIRA.

So the framework must reach _out_ to those tools, distill requirements _in_,
keep everything _coherent as sources change_, and optionally publish
decomposition _back_ to JIRA where the team can see it.

### 1.2 Constraints that shape every decision

| Constraint                                                                                                                                                         | Source                                                 | Implication                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Sensitive-data guard (mode C)** — production/regulated data (real legal & counterparty names, regulated identifiers) must NEVER be copied verbatim into the repo | CANS C-001 / C-020 / C-021; `create-specifications.md` | Ingestion must **de-identify / distill**, never bulk-copy source content into git |

> **What the mode-C guard actually is (verified).** The guard exists, but **only
> inside `/create-specifications`** (re-checked by the `security-auditor`
> agent). It is a **schema-only preservation** rule for _bulk production data_ —
> keep column layout + anonymised samples, never raw rows. It is **not** a
> reusable person/counterparty-name de-identifier, and it does **not** fire
> during `/import-web-page`. Therefore person-name / counterparty
> de-identification for ingested JIRA/Confluence content is a **separate, new
> capability this plan must build** (§2.2.1) — the existing guard is not a layer
> we can inherit for it. | **`create-specifications` reads only text formats**
> (`.md/.txt/.csv/.json/.yaml`) | `create-specifications.md` | JIRA/Confluence
> content must be **materialised as Markdown** (or accessed via MCP) before it
> reaches spec generation | | **Single source of truth per domain** | Project
> reality | Avoid a second, drifting copy of requirements inside the repo | |
> **Token efficiency** ("cost-friendly" = Claude tokens, not dollars) | User
> priority | Prefer **pull-on-demand + diff-scoped fetching**; never re-read
> whole projects | | Secrets only via AWS Secrets Manager / Parameter Store;
> PingID only; CDK v2; Fastify | `CLAUDE.md` critical rules | Unchanged — MCP
> tokens are handled by the MCP layer, not stored in-repo |

### 1.3 What we already have to build on (prior art)

- **`/import-web-page`** (608-line command) already imports Confluence pages via
  the **Atlassian MCP** and writes Markdown to `docs/imports/`. This is the
  proven pattern for Confluence **fetch + convert**, and the Confluence adapter
  reuses that path directly. **But it imports content verbatim** — verified
  against the live command, it does **no** PII scrubbing, redaction, or
  anonymisation (the string "de-identif" does not appear anywhere in it). So the
  adapters inherit its fetch/convert path _only_; the **de-identification pass
  is net-new and must be built** (§2.2.1). De-identification is **not** existing
  prior art.
- **`/reconcile-requirements`** is a mature 6-phase drift-management engine
  (delta taxonomy: BREAKING / ADDITIVE / CORRECTIVE / COSMETIC; epic-revision
  records; code-migration guidance). **`/sync-specs` is this command with a
  live-pull front-end** — not a new engine.
- **`/convert-to-markdown`, `/convert-image-to-mermaid`,
  `/convert-excel-to-csv`** — existing converters the adapters can reuse.
- **Atlassian MCP is available now** (configured at user/global scope). Verified
  this session: site `commbank.atlassian.net`, cloudId
  `998e78d7-2a66-4fc0-809b-b43b4232d4b8`, with both `read/write:jira-work` and
  Confluence read/write scopes.

### 1.4 Grounding: the real EON project (verified via Atlassian MCP)

This plan is grounded in the actual **Entity Onboarding Squad (EON)** board so
the manifest and JQL are real, not illustrative:

| Fact             | Value                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jira project     | `EON` (id `71697`), "Entity Onboarding Squad", Scrum board `78047`                                                                                                                                                                                                                                                                                                                                                     |
| Site / cloudId   | `commbank.atlassian.net` / `998e78d7-2a66-4fc0-809b-b43b4232d4b8`                                                                                                                                                                                                                                                                                                                                                      |
| Issue types      | **16 types** (verified). Level-0: Epic, Story, Task, Bug, Dependency, Tech Debt, Risk Work, **SDLC Practice, Request, Condition, Execution Risk, Execution Issue, Technology Design Decision, Material Decision** (+ Initiative above, Sub-task below). Any `issuetype in (…)` filter that names only the common few will **silently drop real work** — so `/ingest-jira` does not filter by type (§2.3).              |
| Active epics     | `EON-21`, `EON-27`, `EON-28`, `EON-29`, `EON-30`, `EON-31`, `EON-32` — all verified: type Epic, status In Progress, all carry the `[FY27Q1]` prefix                                                                                                                                                                                                                                                                    |
| Scoping signal   | **`fixVersion` is NOT used** on EON (verified: zero EON issues have a fixVersion). The team's delivery-scope signal is the **epic + FY-quarter prefix** (e.g. `[FY27Q1]`), **but the prefix is on epics only — it does not propagate to child issues.** Verified: `summary ~ 'FY27Q1'` matches exactly the 7 epics and zero Stories/Tasks/Bugs. So scope must be **epic-link based**, not summary-prefix based (§2.3). |
| Confluence space | `SEC` — "Digital Service Excellence Crew" (spaceId `1651495149`, verified)                                                                                                                                                                                                                                                                                                                                             |

> **Sensitive-data profile is content-driven per page — not uniform
> (verified).** The de-id pass must **inspect each page and act on what it
> actually finds**, rather than assuming every page carries the same PII
> profile:
>
> - Page `2097876103` ("CITB Solution — Entity onboarding") contains **real
>   person names** (Sophie Hayes, Angelina Ninnis, Soumya Ghosh) and is
>   **actively edited** (last change ~5h before review) — high de-id priority;
>   its live version must be resolved at ingest time, never hand-guessed (§2.1).
> - Page `2127187669` (facility / persona model) is **internal architecture
>   documentation**: system concepts and PPCC staff roles, but **no
>   client/counterparty names**. It still routes through de-id (for staff
>   names/roles), but the blanket "counterparty names need de-identification"
>   assumption does not apply to it.

---

## 2. Design Decisions (with rationale)

### 2.1 Decision: No local copy of source content — pull on demand + thin manifest

Two candidate approaches were considered:

**Option 1 — In-repo `jira/` `confluence/` folders + registry + timestamp
sync.**

- ✅ Offline, greppable, diffable.
- ❌ **Violates the sensitive-data guard by default** — bulk-copies regulated
  content into git.
- ❌ Second source of truth that drifts ("painful and cumbersome to maintain").
- ❌ Registry + timestamp reconciliation is a mini-product.
- ❌ **Token-expensive** — every sync re-reads large local dumps into context.

**Option 2 — No local copy; pull-on-demand; detect drift; suggest spec/epic
updates.**

- ✅ Single source of truth stays in Confluence/JIRA where the team already
  works.
- ✅ Sensitive data is **read → distilled → discarded**; never lands in git.
- ✅ Reuses `/reconcile-requirements`.
- ✅ **Token-cheap** — reads a tiny manifest to decide _what_ changed, pulls
  only deltas.
- ❌ Needs network/MCP at sync time (acceptable — sync is deliberate, not a hot
  path).
- ❌ Needs a lightweight "what changed since last sync?" anchor.

**➡ Decision: Option 2, plus a thin traceability manifest** that resolves its
only weakness.

#### The traceability spine — `specs/sources/manifest.json`

A single committed file storing **pointers and versions only — no requirement
content, no PII**. Seeded below with the **real EON JIRA scope + the two
Confluence pages** the user identified (Figma entries live in the separate
plan):

```jsonc
{
  "version": 1,
  "lastSyncedAt": null, // set on first /sync-specs
  "site": "commbank.atlassian.net",
  "cloudId": "998e78d7-2a66-4fc0-809b-b43b4232d4b8",
  "sources": [
    {
      "kind": "jira-query",
      "id": "eon-fy27q1",
      // EPIC-LINK scope: surfaces the children of the 7 active FY27Q1 epics
      // regardless of issue type. Do NOT scope by "summary ~ 'FY27Q1'" (the prefix
      // is on epics only, so it returns the 7 epics and no work items) and do NOT
      // add an issuetype filter (EON has 16 types; naming a subset drops real work).
      "jql": "project = EON AND parent in (EON-21, EON-27, EON-28, EON-29, EON-30, EON-31, EON-32) ORDER BY updated DESC",
      "scope": "EON board 78047 — children of the 7 active FY27Q1 epics",
      "url": "https://commbank.atlassian.net/jira/software/c/projects/EON/boards/78047/backlog",
      "syncedVersion": null, // max(updated) across matched issues at last sync
      "contentHash": null, // hash of distilled issue set, drift detection
      "mapsTo": { "specSections": [], "epics": [] },
    },
    {
      "kind": "confluence",
      "id": "2097876103",
      "spaceKey": "SEC",
      "title": "[entity] onboarding — CITB solution & architecture", // de-identified
      "url": "https://commbank.atlassian.net/wiki/spaces/SEC/pages/2097876103/CITB+Solution+-+Entity+onboarding",
      // syncedVersion is seeded null on purpose: this page is actively edited, so a
      // hand-set number would already be stale. /add-confluence-page resolves the
      // real version.number authoritatively on first run.
      "syncedVersion": null,
      "contentHash": null,
      "mapsTo": { "specSections": ["BR-*", "FS-*"], "epics": [] },
    },
    {
      "kind": "confluence",
      "id": "2127187669",
      "spaceKey": "SEC",
      "title": "[bank] facility / facility-user / admin persona model", // de-identified
      "url": "https://commbank.atlassian.net/wiki/spaces/SEC/pages/2127187669",
      // syncedVersion seeded null; /add-confluence-page resolves it on first run.
      // (Internal architecture doc — no client/counterparty names — but still
      // routed through de-id for staff names/roles.)
      "syncedVersion": null,
      "contentHash": null,
      "mapsTo": { "specSections": ["BR-*"], "epics": [] },
    },
  ],
}
```

This manifest is the **single join table** between external sources, spec
sections, and epics. It powers drift detection, `/sync-specs`, reverse-sync
linking, and impact analysis — all while being trivially safe to commit (~15
lines per source).

> **Title-safety rule (the one gray area).** JIRA summaries / Confluence page
> titles can contain a counterparty or person name. Adapters MUST run titles
> through the same de-identification pass as body content before writing them to
> the manifest. If a title cannot be safely de-identified, store a **synthetic
> label** (`"[entity] onboarding rules"`) and keep the real title only behind
> the URL — as already done for both EON Confluence entries above.

### 2.2 Decision: Thin per-tool _ingest adapters_, not a fatter `/create-specifications`

`/create-specifications` stays **source-format-agnostic** — it keeps reading
Markdown, as today, and (verified) already accepts a **directory** as input, so
the staging-directory hand-off needs no engine change. (Note it is
_format_-agnostic, not framework-agnostic: it loads CANS-specific templates,
agents, and standards throughout — that is fine here, we only feed it Markdown.)
Each tool gets a dedicated adapter command that owns exactly one concern (fetch
→ de-identify → distill to Markdown):

```text
/ingest-jira        ─┐
                     ├─► specs/.sources-staging/*.md  (gitignored, transient, de-identified)
/add-confluence-page─┘        │
                              └─► /create-specifications  (unchanged: reads Markdown)
```

Rationale:

- The **de-identification pass lives once, in the adapter layer**, where content
  is fetched.
- Adapters are independently testable.
- Staging is transient and gitignored — it is distilled + discarded, keeping the
  expensive spec-generation step's input **lean** (token win).

**Staging path decision — `specs/.sources-staging/`.** The repo already
gitignores `raw-specs/` and `raw-requirements/`, but those are the
human-authored staging inputs for `/create-specifications` and
`/reconcile-requirements` respectively; reusing them would mix machine-ingested,
de-identified source dumps with hand-written inputs and blur which is which. A
dedicated, dotted, gitignored `specs/.sources-staging/` keeps ingested content
clearly separate, co-located with the manifest under `specs/`, and obviously
transient. (This is one new ignore line — see §4.3.)

#### 2.2.1 De-identification is a net-new capability — design it explicitly

This is the plan's **compliance keystone**, and it does **not exist yet**
(§1.3): `/import-web-page` imports verbatim, and the mode-C guard is a
schema-only rule scoped to `/create-specifications`, not a name de-identifier.
Treating de-id as "reused prior art" would **under-scope the single most
safety-critical piece of this plan.** Phase 0 must deliver it as a first-class
artifact.

Open design questions to resolve **before** building the adapters:

1. **Mechanism.** How does de-id actually run? Candidate approaches, each with
   trade-offs:
   - _LLM redaction pass_ — flexible, catches novel names, but non-deterministic
     and can miss/over-redact; needs a verification step.
   - _Deterministic substitution map_ — a committed (safe) alias table
     (`Sophie Hayes → [delivery-lead]`) applied by string match; auditable and
     repeatable, but only catches known entities and must be maintained.
   - _Hybrid_ — deterministic map for known staff/counterparties + LLM sweep for
     the long tail. Likely the right answer; state it.
2. **What counts as sensitive here?** Person names, counterparty/client names,
   regulated identifiers, and internal-only system names. Confirm the taxonomy
   against C-001/C-020/C-021 and the security-auditor's expectations.
3. **Verification / fail-closed.** Reliable automated PII redaction is genuinely
   hard. Define what happens on low confidence: **fail closed** (block staging,
   surface for human review) rather than write possibly-leaky Markdown.
4. **Reuse vs. new.** The `security-auditor` agent already knows the mode-C rule
   — have it (or a shared `source-ingestion-pattern.md`) own the de-id contract
   so `/ingest-jira` and `/add-confluence-page` call **one** implementation.

Until this is designed and built, **no adapter should write to staging.** This
subsection is the acceptance gate for Phase 0.

### 2.3 Decision: JIRA scoping is by JQL, anchored to epic + FY-quarter (not fixVersion)

**Chosen (per user): scope by JQL.** Grounding in the real EON board (§1.4)
revealed that **`fixVersion` is not populated** — so a `fixVersion`-based JQL
would match nothing. The team's actual delivery-scope signal is the **epic**
plus a **`[FY27Q1]`-style prefix** in issue summaries.

`/ingest-jira` therefore accepts a **JQL string** (stored in the manifest as a
`jira-query` source).

**Recommended default — scope by epic link, do not filter issuetype:**

```sql
project = EON
  AND parent in (EON-21, EON-27, EON-28, EON-29, EON-30, EON-31, EON-32)
  ORDER BY updated DESC
```

This surfaces the children of the 7 active FY27Q1 epics regardless of issue
type. (Two-stage alternative: first resolve the active FY27Q1 epics via
`summary ~ 'FY27Q1' AND issuetype = Epic`, then query their children by
`parent in (…)` — useful when the epic set changes between quarters and you
don't want to hard-code keys.)

> **Two traps this default deliberately avoids (both verified live):**
>
> - **Do not scope by `summary ~ 'FY27Q1'`.** The prefix is on epics only, so it
>   returns the 7 epics and **zero work items** — the layer you actually need.
> - **Do not add `issuetype in (Epic, Story, Task, Bug)`.** That names 4 of
>   EON's 16 types and silently drops Dependency, Tech Debt, Risk Work,
>   Execution Risk/Issue, SDLC Practice, and more. Scoping by `parent` captures
>   every child type.

Other scopings the command must also support (all just JQL):

- **By explicit epic keys:** `project = EON AND parent in (EON-27, EON-30)`
- **By explicit issue keys:** `key in (EON-116, EON-30)`
- **Whole active board:** `project = EON AND statusCategory != Done`
- **If you must filter type,** name the _full_ set that carries work, or omit
  the filter and let epic-link scope it.

Drift anchor for a `jira-query` source = **`max(updated)`** across the matched
issue set (+ a content hash of the distilled set), so `/sync-specs` can tell
when _any_ matched issue moved without re-reading all of them.

### 2.4 Decision: Confluence intake = `/add-confluence-page`, then `/sync-specs`

The choice was between (a) a `/add-confluence-page` command that leans on
`/import-web-page`, or (b) hand-editing the manifest then running `/sync-specs`.

**Build `/add-confluence-page` — it is the better ergonomic and the safer
default**, for three reasons:

1. **It enforces the de-identification + title-safety pass by construction.**
   Hand-adding a page to the manifest and running `/sync-specs` works, but a
   human editing JSON can paste a raw title containing a person/counterparty
   name — the exact leak de-identification exists to prevent. A command routes
   every title and body through the de-id pass automatically.
2. **It resolves metadata for you.** Given a page URL or ID, it fetches
   `version.number`, `spaceKey`, and the (de-identified) title, and writes a
   correct manifest entry — no manual JSON, no stale version numbers.
3. **It reuses `/import-web-page` for fetch + convert only, and adds a de-id
   pass.** The Atlassian-MCP fetch and HTML→Markdown convert path is inherited
   wholesale; the only difference on that side is the write target (staging +
   manifest instead of `docs/imports/`). But `/import-web-page` has **no**
   de-identification (§1.3), so the wrapper is _not_ thin overall — it must add
   the net-new de-id pass from §2.2.1 between convert and stage. "Thin"
   describes the fetch/convert reuse; de-id is the added weight.

**Flow:** `/add-confluence-page <url|id>` → resolves `version.number` and stages
de-identified Markdown → registers/refreshes the manifest entry (seeding
`syncedVersion` with the resolved number on first run) → then `/sync-specs` (or
`/create-specifications` on first build) consumes the staged Markdown. So the
answer is **"a command, _and_ it then feeds the existing `/sync-specs`"** — not
either/or.

The two EON pages (`2097876103` and `2127187669`) are seeded in the manifest
above with `syncedVersion: null`; the first `/add-confluence-page` run against
each resolves the live version number and records it. From then on, that command
keeps them current and is how future pages get added safely.

### 2.5 Decision: Reverse-sync is dry-run-first, human-approved; DoD goes in the description

Framework → JIRA push previews every Epic/Story/Task it would create or update;
a human approves before anything is written to the **real, shared EON board**.
Direction-of-truth rule:

> **JIRA owns _intent_ (what/why). The framework owns _decomposition & delivery_
> (how/done).**
>
> - Business intent flows **JIRA → framework** (inbound).
> - Technical decomposition (epic-tasks) + delivery status flow **framework →
>   JIRA** (outbound), always **linked back** via the manifest.
> - The manifest is the join table; every artifact on both sides carries the
>   other's ID.

**Definition of Done representation (per user): just add it in the
description.** `/push-to-jira` renders the framework's DoD checklist and
acceptance criteria as a Markdown section inside the issue **description** (via
the Atlassian MCP `contentFormat: "markdown"`), not as a custom field or
sub-tasks. This needs no EON JIRA config changes and is visible to the whole
team inline. Acceptance criteria go in the same description block.

This prevents sync loops and board spam.

### 2.6 Decision: `/sync-specs` conflict policy = flag + interactive human resolution

When `/sync-specs` finds that **both** a source (JIRA/Confluence) **and** the
local spec changed since the last sync, it does **not** auto-pick a winner. It:

1. **Flags a conflict** with a clear three-column diff — _source version now_ vs
   _last synced_ vs _current local spec_ — for the affected spec section.
2. **Pauses and resolves interactively with the human**, offering explicit
   choices per conflict: take source, keep local, or merge (with a proposed
   merge to edit).
3. Only writes once the human decides; then advances the manifest version.

The **human-resolution UX is reused** from `/reconcile-requirements` — its
existing interactive clarification gate handles the "take source / keep local /
merge" decision, so `/sync-specs` does not build a new resolution mechanism. But
the seam between the two commands is an **adapter, not free reuse**, and the
plan treats it as the second-largest net-new build after de-identification
itself:

- **`/reconcile-requirements` cannot accept live-pulled deltas.** Its command
  file (`reconcile-requirements.md:77`) requires `$ARGUMENTS` to be _"a readable
  file or directory path"_ and validates the path exists before Phase 1.
  `/sync-specs` therefore cannot hand it an in-memory delta — it must **pull →
  de-identify → materialize the distilled source as a file on disk** (in the
  staging dir, §4.3) and then invoke reconcile with that **path**. That
  materialize + de-id step is net-new adapter logic; only the reconciliation
  _engine_ is reused.
- **The three-way conflict diff is new logic layered _on top of_ reconcile, not
  inside it.** `/reconcile-requirements` compares _corrected-requirements-file_
  vs _current-spec_ (two-way). The policy above needs a **three-way** diff —
  _source-now_ vs _last-synced_ vs _current-local-spec_ — where the
  "last-synced" anchor is the manifest's `syncedVersion` / `contentHash`.
  Computing that anchor and producing the three-column diff is `/sync-specs`'
  own responsibility; it feeds the _result_ into reconcile's existing gate,
  which handles resolution but does not compute the diff.

---

## 3. Target Architecture

```text
                        ┌──────────────────────────────────────┐
   SOURCES OF TRUTH     │  JIRA (EON)          Confluence (SEC)  │
   (team lives here)    │  epics/stories/      documents /       │
                        │  tasks/bugs          project info      │
                        └───────┬───────────────────┬───────────┘
                          Atlassian MCP        Atlassian MCP
                                │                   │
   INGEST ADAPTERS      ┌───────▼───────────────────▼───────────┐
   (de-identify +       │ /ingest-jira      /add-confluence-page │
    distill → Markdown) └───────┬───────────────────────────────┘
                                │
   STAGING (gitignored)  specs/.sources-staging/*.md
                                │
                        ┌───────▼───────────────────────────────┐
   FRAMEWORK CORE       │ /create-specifications                 │
   (unchanged engines)  │        │                               │
                        │  specs/business-requirements.md        │
                        │  specs/functional-specifications.md    │
                        │        │                               │
                        │  /create-epics → epics → /implement-epic → code
                        └────────┼───────────────────────────────┘
                                 │
   TRACEABILITY SPINE    specs/sources/manifest.json   (pointers + versions only)
                                 │
   CHANGE MANAGEMENT     ┌───────▼────────┐        ┌────────────────────────┐
                         │  /sync-specs   │───────►│ /reconcile-requirements│ (delegated)
                         │ (diff-scoped   │        │  phases 1–6            │
                         │  live pull;    │        │  + interactive conflict│
                         │  flag conflict)│        │    resolution gate     │
                         └───────┬────────┘        └────────────────────────┘
                                 │
   REVERSE-SYNC          ┌───────▼────────┐
   (dry-run, approved)   │ /push-to-jira  │──► EON Epics/Stories/Tasks
                         └────────────────┘     (linked back; DoD + AC in description)
```

---

## 4. New / Changed Framework Artifacts

### 4.1 New commands

| Command                                            | Purpose                                                                                                                                                                                          | Reuses                                                                                                                           | Token profile                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `/ingest-jira <JQL>`                               | Fetch JIRA issues via Atlassian MCP by **JQL**, de-identify, distill to staging Markdown; register a `jira-query` source in the manifest                                                         | Atlassian MCP fetch + the shared **net-new** de-id mechanism (§2.2.1) — **not** an `import-web-page` de-id pattern (none exists) | **Cheap–moderate** (scoped by JQL)         |
| `/add-confluence-page <url\|id>`                   | Wraps `import-web-page` for **fetch + convert only**; then applies the **net-new** de-id mechanism to title + body, stages Markdown, writes/refreshes manifest entry (resolves `version.number`) | `import-web-page` (fetch/convert only — **de-id is net-new**, §2.2.1)                                                            | Moderate                                   |
| `/sync-specs [--dry-run] [--source=…] [--since=…]` | Diff live sources vs manifest versions; classify deltas; **flag source-vs-local conflicts and resolve interactively**; **delegate to `/reconcile-requirements`**                                 | `reconcile-requirements` (engine)                                                                                                | **Cheap** to detect, scoped to pull deltas |
| `/push-to-jira <epic\|epic-task> [--dry-run]`      | Preview + (on approval) create/update EON Epics/Stories/Tasks with **AC + DoD in the description**, back-linked                                                                                  | `createJiraIssue`, `createIssueLink`, `editJiraIssue`                                                                            | Cheap–moderate                             |

### 4.2 Changed commands

| Command                  | Change                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/create-specifications` | Accept a **staging directory** of ingested Markdown as one of its inputs (no engine change — it already reads Markdown). Document the JIRA/Confluence → staging flow.                                      |
| `/add-feature`           | Accept a **JIRA key** (e.g. `/add-feature EON-30`) via a new input-classifier branch (details below), then run the normal ambiguity → sizing → epic flow; record the JIRA key in the manifest + epic file. |

**`/add-feature EON-30` is a new code branch, not config.** Today `/add-feature`
resolves a _story-id_ input by scanning **local files on disk** (spec/story docs
already in `specs/`). `EON-30` is not a local file — it is a live JIRA key that
would resolve to nothing in that scan and fall through to being treated as
free-text. Making it work requires a new input-classifier branch at the top of
`/add-feature` that:

1. detects the `^[A-Z]+-\d+$` JIRA-key pattern **before** the local-file scan;
2. invokes `/ingest-jira` (the shared ingest adapter) to pull + de-identify the
   ticket into staging;
3. re-enters the normal flow with the materialized staging file as the input.

This depends on Phase 1 (`/ingest-jira` + the ingest adapter) already existing,
so the `/add-feature` change ships **within** Phase 1, not before it.

### 4.3 New / changed supporting files

| File                                                   | Purpose                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs/sources/manifest.json`                          | **New.** Traceability spine (§2.1), seeded with real EON JQL + the two SEC Confluence pages. Committed; pointers + versions only.                                                                                                                                                             |
| `specs/.sources-staging/`                              | **New, gitignored.** Transient de-identified Markdown between ingest and spec generation.                                                                                                                                                                                                     |
| `.claude/patterns/source-ingestion-pattern.md`         | **New.** Canonical de-identification + distillation _rules_ shared by all adapters. This documents the mechanism; it does not replace building it. §2.2.1 also requires a single shared de-id _implementation_ (the fail-closed function every adapter calls), built and verified in Phase 0. |
| `.claude/standards/traceability-manifest-standards.md` | **New.** Manifest schema, hashing, title-safety rule, join semantics, `jira-query` drift anchor.                                                                                                                                                                                              |
| `.gitignore`                                           | Add `specs/.sources-staging/`.                                                                                                                                                                                                                                                                |
| `CLAUDE.md` (root + `.claude/`)                        | Add the JIRA/Confluence ingestion + `/sync-specs` + `/push-to-jira` entries to the lazy-load table. **(No UI-library change here — that lives in the Lumen/Figma plan.)**                                                                                                                     |
| `.mcp.json` or user MCP config                         | Ensure the Atlassian MCP is registered for the repo (currently only playwright is pinned in repo `.mcp.json`; Atlassian is global).                                                                                                                                                           |

---

## 5. Phased Delivery Plan

Each phase is independently valuable and independently shippable. **All phases
are available now** — nothing here waits on the Figma license.

### Phase 0 — Foundations (2–3 days)

**Phase 0 is the compliance keystone, not a quick setup task.**
De-identification is net-new (§1.3 / §2.2.1: `/import-web-page` imports
verbatim, zero redaction) and is the _gate_ that makes every later phase safe to
run against regulated EON/SEC data. Building the mechanism and proving it
fail-closed is the real deliverable; the manifest and pattern docs are the easy
part. **Nothing in Phases 1–3 may run against live Atlassian data until this
phase's exit criterion is met.**

- Create `specs/sources/manifest.json` (seeded per §2.1) +
  `traceability-manifest-standards.md`.
- Create `source-ingestion-pattern.md` (de-identification + distillation rules;
  mode-C guard; title-safety rule).
- **Build and verify the de-identification mechanism itself (§2.2.1)** — not
  just the pattern doc. Choose the mechanism (LLM pass / deterministic
  substitution map / hybrid), implement the single shared de-id function all
  adapters call, and prove it **fail-closed** against the two real SEC pages
  (the one with Sophie Hayes / Angelina Ninnis / Soumya Ghosh **must** come
  through with those names redacted, and a verification step must refuse to
  stage if any residual PII is detected).
- Add `specs/.sources-staging/` to `.gitignore`.
- Confirm Atlassian MCP connectivity (already verified this session).

**Exit:** manifest + patterns exist; Atlassian MCP reachable; **the
de-identification mechanism is implemented and demonstrated fail-closed on real
SEC content** — no person/counterparty name reaches staging.

### Phase 1 — JIRA + Confluence ingestion

- Build `/add-confluence-page` (reuses `import-web-page` fetch/convert; adds the
  Phase 0 de-id pass before staging — §2.4).
- Build `/ingest-jira` (issues by **JQL**; stores a `jira-query` manifest
  source).
- Wire both into `/create-specifications` via the staging directory.
- Extend `/add-feature` to accept a JIRA key.
- Every ingest writes/updates the manifest.

Two things this phase must get right:

- **Ingest with the epic-link JQL from §2.3, not the summary-prefix.** The
  manifest is already seeded with `parent in (EON-21, EON-27, …)`; using
  `summary ~ 'FY27Q1'` instead would silently drop the entire child-story/task
  layer (§1.4).
- **`/add-feature EON-30` requires the §4.2 classifier branch.** It is built as
  part of this phase, not inherited from the existing story-id path.

**Exit:** the two SEC Confluence pages + the EON FY27Q1 JQL set can generate
`specs/business-requirements.md` + `specs/functional-specifications.md`, fully
de-identified, with a populated manifest; `/add-feature EON-30` works end to
end.

**Token profile:** cheap–moderate; scoped by explicit JQL/pages, distilled
before spec gen.

### Phase 2 — Change management: `/sync-specs`

- Build `/sync-specs`: read manifest → pull only sources whose version advanced
  (Confluence `version.number`; JIRA `max(updated)` for a `jira-query`) →
  compute deltas → classify (BREAKING/ADDITIVE/CORRECTIVE/COSMETIC) → **flag
  source-vs-local conflicts and resolve interactively (§2.6)** → **delegate to
  `/reconcile-requirements`** → update manifest versions.
- `--dry-run` for impact preview; `--source=` and `--since=` to scope.

**Exit:** editing a SEC Confluence page or moving an EON ticket, then running
`/sync-specs`, surfaces a scoped delta report, pauses on any conflict for human
resolution, and drives the existing reconciliation engine. Manifest versions
advance.

**Token profile:** cheap to detect (manifest-only); pulls scoped to deltas.

### Phase 3 — Reverse-sync: `/push-to-jira`

- Build `/push-to-jira` (dry-run-first): map framework epic → EON Epic,
  epic-task → Story/Task, **DoD + AC → issue description (Markdown)**.
- Create issue links back to the originating ticket; record JIRA keys in the
  manifest.
- Human approval gate before any write to the shared EON board.

**Exit:** a generated epic can be previewed as EON items and, on approval,
created

- linked, visible to the non-technical team, with DoD and AC in the description.

**Token profile:** cheap–moderate.

### Phase 4 — Human workflow guide (documentation)

The final step of implementing this plan is to write a **human-facing guide** so
the (mostly non-technical) team and future engineers can use the new capability
without reading framework internals.

- Create **`docs/JIRA-Confluence-workflow-guide.md`** covering:
  - What the integration does and the direction-of-truth rule (§2.5) in plain
    language.
  - **How to add a Confluence page** (`/add-confluence-page <url|id>`) — step by
    step.
  - **How to ingest JIRA** by JQL (`/ingest-jira "<JQL>"`), with the EON FY27Q1
    example and how to change scope (by epic, by keys, whole board — §2.3).
  - **How to generate specs** from ingested sources (`/create-specifications`).
  - **How to keep specs in sync** (`/sync-specs`), including what a conflict
    looks like and how the interactive resolution prompts work (§2.6).
  - **How to push work back to JIRA** (`/push-to-jira`) and where DoD/AC appear.
  - **What the manifest is** (`specs/sources/manifest.json`) and the golden
    rule: never paste real names / regulated identifiers into it (title-safety,
    §2.1).
  - A one-page "cheat sheet" of the end-to-end loop.

**Exit:** `docs/JIRA-Confluence-workflow-guide.md` exists and a non-technical
teammate can follow it to add a source and run a sync unaided.

---

## 6. How this maps onto `epic-based-development.md`

The two existing entry points gain source-aware front-ends; the core flow is
unchanged:

```text
Greenfield / major phase:
  /add-confluence-page (×2 SEC pages) + /ingest-jira "<EON JQL>"
    → /create-specifications  (reads staging)
    → /create-epics → /implement-epic | /create-epic-tasks
    → (optional) /push-to-jira

Single feature:
  /add-feature EON-30          (pulls the JIRA ticket, de-identifies, then normal flow)

Ongoing change:
  /sync-specs                  (live-pull front-end → /reconcile-requirements,
                                interactive conflict resolution)
```

The **traceability manifest** is the new durable artifact that ties external
sources to specs and epics across all of these.

---

## 7. Token-Cost Strategy (summary)

| Lever                      | Rule                                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No local copy**          | Manifest (pointers+versions) instead of content dumps — nothing large re-read per sync                                                                                                                                      |
| **Diff-scoped fetching**   | `/sync-specs` pulls only sources whose version advanced; never whole projects                                                                                                                                               |
| **JQL-scoped JIRA**        | `/ingest-jira` reads only the matched issue set, never the whole board — and the JQL must be _correct_ as well as scoped: the epic-link form (§2.3), not the summary-prefix form, or child issues are dropped.              |
| **Distill then discard**   | Adapters compress source trees into scoped, de-identified slices _before_ spec generation sees them. The de-id step is a net-new mechanism (§2.2.1), so it carries real per-source token + build cost — budgeted, not free. |
| **Reuse, don't duplicate** | `/sync-specs` reuses `/reconcile-requirements`' human-resolution gate; no parallel drift engine to load. The pull→materialize→de-id→three-way-diff pipeline that feeds that gate is net-new (§2.6).                         |

---

## 8. Enterprise Coordination Patterns (how others solve this)

- **Paid connectors** (Unito, Exalate, Atlassian automation) do field-level
  bi-directional record sync between JIRA/Confluence. They keep _records_
  aligned but **do not do AI decomposition or spec synthesis** — a human BA
  still writes the requirements and breaks down the work.
- **The universal friction** they all struggle with is exactly this project's
  problem: requirements in Confluence, work in JIRA, and **keeping them coherent
  is manual toil**.
- **Our differentiator:** the "expensive connector" is already owned — it's the
  **MCP layer + Claude**. The novelty is that **the AI performs the
  distillation, decomposition, and reconciliation** that off-the-shelf
  connectors can't. **We buy nothing new**; the integration is framework
  commands over the existing Atlassian MCP. (Cost, per the user, is measured in
  Claude tokens — §7 — not licences.)

---

## 9. Decision Log

Every decision below was verified against live Atlassian data and the
framework's own command files. Each is settled in direction; the notes record
the corrections and the net-new effort each one actually implies (folded into
§1–§5 above).

1. **JIRA scoping — by JQL, anchored on epic-link.** Scope with `parent in (…)`,
   _not_ the `[FY27Q1]` summary prefix: the prefix is epic-level only, so
   `summary ~ 'FY27Q1'` returns 7 epics and silently drops every child
   story/task. `fixVersion` is unused on EON. See §2.3.
2. **Confluence intake — build `/add-confluence-page`.** It reuses
   `import-web-page` for fetch/convert only; de-identification is net-new
   (`import-web-page` imports verbatim). See §2.4 + §2.2.1.
3. **DoD representation in JIRA — in the issue description** (Markdown). See
   §2.5.
4. **Conflict policy — flag + interactive human resolution.** The
   human-resolution gate is reused from `/reconcile-requirements`; the three-way
   diff + materialize-to-file adapter feeding it is net-new. See §2.6.
5. **De-identification — a net-new, blocking prerequisite.** Not inherited from
   any existing command; must be built and proven fail-closed as the Phase 0
   gate before any live EON/SEC ingestion. This is the single largest build in
   the plan. See §2.2.1 + Phase 0.
6. **Figma + DaisyUI→Lumen — moved out** to
   [`docs/lumen-figma-plan.md`](./lumen-figma-plan.md) as an independent track.

---

## 10. Recommended First Step

Once ready to implement (separate from this plan):

1. **Phase 0 + Phase 1** — foundations + JIRA/Confluence ingestion. Delivers
   immediate value with tools available **today**.
2. Prove the loop end-to-end on the **two SEC Confluence pages + the EON FY27Q1
   JQL** → generated specs → one epic.
3. Then Phase 2 (`/sync-specs`), Phase 3 (`/push-to-jira`).
4. The Figma + Lumen track runs separately via
   [`docs/lumen-figma-plan.md`](./lumen-figma-plan.md).

> **This document is a plan only. No framework files have been modified.**
