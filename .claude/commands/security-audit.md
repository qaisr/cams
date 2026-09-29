---
name: security-audit
description: >
  Standalone deep security audit command. Faster and more focused than the
  full best-practices run. Covers OWASP Top 10, NestJS/Passport-JWT, Next.js
  security, secrets, and API security. Can be run before releases or
  after security-sensitive changes.
version: 1.0.0
requires:
  agents:
    - .claude/agents/security-auditor.md
  workflows:
    - .claude/workflows/best-practices-analysis.md
interaction: conversational
phases: 4
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# 🔒 Security Audit Command

A focused, interactive security audit for your full-stack application.
Faster than `/implement-best-practices` — security category only.

**Ground Rules for Claude:**
- NEVER proceed to the next phase without user confirmation
- Show ACTUAL vulnerable code from the codebase — never generic examples
- Be honest about severity — do not inflate or downplay
- Distinguish exploitable-now from theoretical risks
- If you find a CRITICAL issue, surface it immediately — do not bury it

---

## PHASE 1 — AUDIT CONFIGURATION

```
🔒 Security Audit

I'll perform a focused security analysis of your codebase.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — What triggered this audit?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 [1]  Pre-release security check
 [2]  Post-feature security review
 [3]  Routine / scheduled audit
 [4]  Suspected specific vulnerability
 [5]  First-time audit of this codebase

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 2 — Which areas should I focus on?

 [1]  Authentication & Authorization     (NestJS Guards, JWT/PingID validation, RBAC)
 [2]  Input Validation & Injection       (Zod schemas, SQL injection via Prisma, XSS, CSRF, path traversal)
 [3]  API Security                       (CORS, rate limiting, security headers)
 [4]  Secrets & Configuration            (env vars, Secrets Manager usage)
 [5]  Frontend Security                  (Next.js specific, CSP, env variable exposure)
 [6]  Dependency Vulnerabilities         (known CVEs in current versions)
 [7]  Full audit                         (all of the above)

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 3 — Any known context I should factor in?
  (e.g. "we use PingID not standard OAuth", "auth is handled upstream by API Gateway authorizer",
   "this service is internal only — no public endpoints")

  Describe or type  none.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

```
STEP 4 — Scope

 [1]  Full codebase
 [2]  Backend only
 [3]  Frontend only
 [4]  Specific files or modules — I'll specify

──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

Confirm and proceed:

```
✅ Audit configured:
   Focus areas : [LIST]
   Scope       : [ANSWER]
   Context     : [ANSWER]

Type  go  to start the scan.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

---

## PHASE 2 — SECURITY SCAN

Invoke `.claude/agents/security-auditor.md` for the selected focus areas.

Produce findings using this format for each issue:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SEVERITY BADGE] [Finding Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Severity   : 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW / ℹ️ INFO
OWASP Ref  : [A01:2021 - Broken Access Control, etc.]
Location   : [file path, line numbers]

Vulnerable code:
  ```ts
  [ACTUAL CODE from the codebase]
  ```

What it is : [clear, specific description]
How to exploit: [realistic attack scenario — be concrete]
Impact     : [what an attacker gains]

Fix:
  ```ts
  [corrected code]
  ```

Effort to fix: [Low / Medium / High]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

⚠️ If a CRITICAL finding is found at any point during the scan:
Surface it immediately with this banner:

```
🚨 CRITICAL FINDING — Surfacing immediately before continuing scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Full finding details]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do you want to:
  [F]  Fix this now before continuing the scan
  [C]  Continue scanning, fix everything at the end
```

**[WAIT FOR USER INPUT on critical findings]**

After full scan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECURITY SCAN SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔴 Critical : [n]
  🟠 High     : [n]
  🟡 Medium   : [n]
  🟢 Low      : [n]
  ℹ️  Info     : [n]

OWASP coverage:
  [list which OWASP Top 10 categories were checked and status]

Overall security posture: [CRITICAL RISK / HIGH RISK / MODERATE / GOOD / STRONG]

Type  continue  to move to remediation options.
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT]**

> **Context Compaction**: If context is getting long after the scan, you may compact before Phase 3.
> Before compacting, preserve: (a) all findings with OWASP mapping and severity, (b) any CRITICAL
> findings surfaced mid-scan. Then continue from Phase 3 with that preserved summary.

---

## PHASE 3 — REMEDIATION PLAN

For each finding, present:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMEDIATION — [Finding Title]             [Severity]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option A — [Recommended Fix]              ★ RECOMMENDED
  [description, code, effort, side effects]

Option B — [Alternative / Lighter Fix]
  [description, when appropriate, trade-offs]

Option C — Accept risk
  [specific risk accepted, mitigation available, revisit trigger]

Your choice? [A / B / C]
──────────────────────────────────────────
```

**[WAIT FOR USER INPUT per finding]**

---

## PHASE 4 — IMPLEMENTATION & REPORT

After all decisions:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMEDIATION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Will fix  : [n] findings
Deferred  : [n] findings

Shall I implement the fixes now?
  [Y]  Yes — implement systematically with confirmation per change
  [R]  Generate report only — I'll implement manually
  [S]  Save findings to file — specify path
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**[WAIT FOR USER INPUT]**

If Y: Follow the Phase 5 implementation pattern from `implement-best-practices.md`.

If R or S: Generate a security report in this format:

```markdown
# Security Audit Report
Date: [date]
Scope: [what was scanned]
 
## Executive Summary
[3-5 sentence summary of overall posture and top risks]

## Critical & High Findings
[Full finding details]

## Medium & Low Findings
[Summary table]

## Deferred Items
[List with accepted risks]

## Recommended Next Steps
[Ordered action list]
```

Ask:
```
Report generated. 

Do you want me to update the .claude framework to reflect 
any new security standards established by this audit?
  [Y]  Yes — run framework sync
  [N]  No
```

**[WAIT FOR USER INPUT]**

If Y: Invoke `.claude/workflows/framework-sync.md` in `.claude → codebase` direction.
