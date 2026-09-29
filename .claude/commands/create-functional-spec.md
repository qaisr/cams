---
description: Create a detailed, implementation-ready functional specification (with technical detail and design diagrams) from a source document, existing code, or both.
agent: build
subtask: false
model: @bedrock-eus2/us.anthropic.claude-opus-4-8
reasoning_effort: high
---

# Create Functional Specification

## Input

$ARGUMENTS
Examples:

- `/create-functional-spec @path/to/requirements.docx`
- `/create-functional-spec @path/to/existing-spec.md`
- `/create-functional-spec from-code`
- `/create-functional-spec from-code @apps/api/src/ @apps/web/src/`
- `/create-functional-spec @path/to/requirements.md + from-code`

---

## Token Policy

This is a **generation** command. Token-efficiency rules are **relaxed**: read
the source document(s) and/or referenced code in full and produce a complete,
detailed functional specification. Do not summarise or skip sections of the
input to save tokens. There is no separate concise output — the detailed
`specs/functional-specifications.md` is the single source of truth for all
downstream commands. See `@.claude/docs/context-optimization.md` (Generation
Phase Exception).

### Technical Detail & Design Diagrams (all modes)

> **CRITICAL — source is discarded after generation.** The source supplied via
> `$ARGUMENTS` (document and/or existing code) will be **deleted** once this
> spec is generated. `specs/functional-specifications.md` becomes the only
> durable record. Capture **every single detail** needed to build the actual
> app — EVERY LITTLE DETAIL — in the generated spec. Nothing from the source
> may be lost, summarised away, or left implicit; if a detail has no obvious
> home in the template, add a section for it rather than dropping it. After
> writing, re-read the source and confirm nothing is missing.

The generated functional specification must be **implementation-ready**:

- **Technical completeness** — every functional and non-functional requirement
  carries the detail an AI agent needs to implement without guessing: entities
  and fields (type, nullability, constraints), relationships and cardinalities,
  endpoints (method, path, request/response, status codes), DTO/validation
  rules, RBAC permissions per operation, domain events and payloads, and
  error/edge-case handling. Keep it terse and structured (tables, bullet lists),
  not verbose prose — the consumer is an AI agent.
- **Design diagrams** — embed **Mermaid** diagrams inline (dedicated sections)
  so a human can verify the plan before code is written. Include only the
  diagram types that make sense; multiples of a type are allowed; omit a type
  if it adds nothing. Candidates: data model / ER / class / object, flowchart,
  state, component, activity, user-journey, use-case, architecture / C4, data
  flow, sequence. Diagrams must be scoped to this application's modules and easy
  to modify to fit PPCC requirements. Every diagram MUST follow the binding
  standard `@.claude/standards/mermaid-standards.md` (portable syntax, sparing
  emoji, `classDef` theme, `subgraph` boundaries, `accTitle`/`accDescr`); see
  `.claude/commands/diagram-create.md` for authoring examples.

---

## Mode Detection

Parse $ARGUMENTS to determine mode:

| Input Pattern | Mode |
|---|---|
| `@path/to/file` only | **doc-mode** — extract from document |
| `from-code` only | **code-mode** — reverse-engineer from codebase |
| `@path/to/file + from-code` | **combined-mode** — document fills gaps, code fills rest |
| No arguments | **interactive-mode** — ask user which mode |

---

## Mode 1: Document Mode (`@path/to/file`)

### Step 1: Read Source Document

Read the referenced file completely.
Supported inputs:

- Markdown (`.md`)
- Plain text (`.txt`)
- Any readable format

### Step 2: Extract Information

Scan the document for:

```

EXTRACT these categories from the document:

1. APPLICATION NAME & VISION
   - App name, product name, project name
   - Problem being solved
   - Target users / personas
   - Business value / outcomes

2. USER ROLES & PERMISSIONS
   - All named roles (admin, manager, viewer, etc.)
   - What each role can do
   - Map to PingID scopes if mentioned

3. FEATURES & REQUIREMENTS
   - All functional requirements
   - Feature descriptions
   - User stories or use cases if present
   - Priority indicators (must/should/could, P1/P2/P3, MoSCoW)

4. NON-FUNCTIONAL REQUIREMENTS
   - Performance targets (response times, throughput)
   - Availability / uptime targets
   - Security requirements
   - Compliance (APRA, PCI, Privacy Act, etc.)
   - Scalability expectations

5. DOMAIN ENTITIES
   - Nouns that represent data objects
   - Relationships between entities
   - Key attributes mentioned

6. INTEGRATIONS
   - External systems named
   - APIs referenced
   - Third-party services

7. CONSTRAINTS
   - Technical constraints
   - Business rules
   - Out-of-scope items

8. OPEN QUESTIONS
   - Ambiguities in the document
   - Missing information
   - Conflicting requirements

```

### Step 3: Gap Analysis

After extraction, identify what is MISSING from the document
that the functional-spec template requires:

```

MISSING INFORMATION (will use PPCC defaults or placeholders):

- [ ] Performance targets → will use PPCC standard defaults
- [ ] PingID scope names → will use {resource}:read/write/admin pattern
- [ ] Tech stack details → will use PPCC standard stack
- [ ] [Any other gaps found]

```

Present gap list to user and ask:

```

I found the following information gaps. I will use PPCC standard
defaults for these. Should I proceed, or would you like to
provide any of these values first?

[gap list]

Type 'proceed' to continue with defaults, or provide any
missing values now.

```

### Step 4: Generate Functional Spec

Populate the template using extracted information + PPCC defaults for gaps:

- Template: `@.claude/templates/functional-specifications.md`

Write the output:

- `specs/functional-specifications.md`

Apply the **Technical Detail & Design Diagrams** requirement (see Token Policy).
Mark any values that need human review with `<!-- REVIEW: reason -->`.

---

## Mode 2: Code Mode (`from-code`)

### Step 1: Discover Codebase Structure

```bash
# Understand what we are working with
!`find . -name "*.controller.ts" | grep -v node_modules | head -30`
!`find . -name "schema.prisma" -o -path "*/src/modules/*/*.service.ts" | grep -v node_modules | head -30`
!`find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v ".test." | head -40`
!`find . -name "*.yaml" -o -name "*.yml" | grep -i openapi | head -10`
!`find . -path "*/prisma/migrations/*" -o -name "schema.prisma" | sort | head -20`
!`ls -la .claude/docs/ 2>/dev/null || echo "No .claude/docs yet"`
```

### Step 2: Read Key Files

Read in this order to build understanding progressively:

**Round 1 — Structure overview**

```
Read these to understand the application shape:
- package.json (root + apps/api + apps/web) (app name, version, dependencies)
- README.md if exists (any description)
- Main application config: local.env.json.example / apps/api bootstrap config
- Root layout: apps/web/app/layout.tsx (if exists)
```

**Round 2 — Domain model**

```
Read to understand data model:
- Prisma schema in `packages/database/prisma/schema.prisma` (source of truth)
- Migration files in `packages/database/prisma/migrations/` (schema history)
- Zod schema files in `packages/validation/src/` and generated Zod in `packages/database/generated/zod/`
```

**Round 3 — Features and API**

```
Read to understand capabilities:
- All NestJS controllers in `apps/api/src/**/**.controller.ts` (API endpoints)
- OpenAPI specs in */openapi/*.yaml (API contracts)
- All pages in `apps/web/app/` (user-facing features)
- All routes in NextJS app directory
```

**Round 4 — Auth and security**

```
Read to understand auth model:
- NestJS auth guards/strategies if present
- Middleware: apps/web/src/middleware.ts or apps/web/middleware.ts
- Any PingID or auth-related config files
```

### Step 3: Reverse-Engineer Specification

From the code, derive:

**Application Name and Vision**

```
- Name: from root/apps package.json name / app config
- What it does: inferred from controller names, entity names, page names
- Users: inferred from role names, scope names, user-related entities
```

**Features** (one per controller or major page group)

```
For each controller found:
  Feature name = controller name without "Controller"
  Operations = HTTP methods and paths found
  Status = "Complete" (it exists in code)

For each page group found:
  Feature name = route segment name
  Screens = page.tsx files found
  Status = "Complete"
```

**Domain Model**

```
For each Prisma model / TypeScript type:
  Entity name = class name
  Key attributes = field names and types
   Relationships = Prisma relation fields and `@relation` mappings
```

**Roles and Permissions**

```
Look for:
- Enum types containing ROLE_, ADMIN, USER, etc.
- @RequirePermissions decorators / permissions guards
- permission checks in guards/services and route metadata
- PingID scope strings in code
- requestAttribute("scope") usages
```

**Non-Functional Requirements**

```
Look for:
- Timeout values in config files
- Cache TTL values
- Rate limiting config in CDK, API Gateway, or service config
- Performance-related comments or annotations
- If not found: use PPCC standard defaults
```

**Integrations**

```
Look for:
- External HTTP clients (NestJS HttpService, fetch/axios wrappers)
- SNS/SQS topic ARNs
- External URLs in config
- Third-party SDK imports
```

### Step 4: Confidence Assessment

For each section, rate extraction confidence:

```
EXTRACTION CONFIDENCE REPORT:
✅ High confidence (found explicit code/config)
  - Domain entities: [list]
  - API endpoints: [list]
  - Auth mechanism: PingID detected

⚠️ Medium confidence (inferred from patterns)
  - Application purpose: [inferred description]
  - User roles: [inferred from code]

❓ Low confidence (guessed or defaulted)
  - Business value: [PLACEHOLDER — needs human input]
  - Performance targets: [using PPCC defaults]
  - Compliance requirements: [PLACEHOLDER]
```

### Step 5: Generate Functional Spec

Produce the functional specification output from
reverse-engineered information:

- Output from `@.claude/templates/functional-specifications.md`
- Written to: `specs/functional-specifications.md`

Apply the **Technical Detail & Design Diagrams** requirement (see Token Policy);
derive the diagrams from the code you inspected.
Mark inferred values: `<!-- INFERRED from [source] — verify -->`
Mark unknown values: `<!-- UNKNOWN — requires human input -->`

---

## Mode 3: Combined Mode (`@file + from-code`)

Run both Mode 1 and Mode 2, then merge:

**Merge Strategy**

```
Priority order for each field:
1. Explicit value from source document (highest confidence)
2. Value from existing code (medium confidence)
3. PPCC standard default (fallback)
4. PLACEHOLDER comment (when nothing found)

Conflicts:
- If document says X and code says Y → use document value,
  add comment: <!-- CODE SHOWS: Y — verify which is correct -->
```

---

## Mode 4: Interactive Mode (no arguments)

Ask user:

```
No source provided. How would you like to create the
functional specification?

1. From a requirements document
   → Run: /create-functional-spec @path/to/your/document.md

2. From existing code (reverse-engineer)
   → Type: /create-functional-spec from-code

3. From both (document + code)
   → Run: /create-functional-spec @path/to/doc + from-code

4. Start from scratch interactively
   → I will ask you questions one section at a time

Type the number of your choice or re-run the command
with arguments.
```

If user chooses **option 4**, run the interactive interview below.

---

## Interactive Interview (Option 4)

Ask each question and wait for the answer before proceeding.
Build the spec section by section.

```
SECTION 1 — Vision
Q1: What is the name of this application?
Q2: What problem does it solve? (1-2 sentences)
Q3: Who are the primary users? (e.g., PPCC staff, customers, branch managers)
Q4: What is the main business value or outcome?

SECTION 2 — Users and Roles
Q5: List the user roles and what each can do.
    (e.g., "Admin: full access, Viewer: read only")

SECTION 3 — Features
Q6: List the core features in priority order.
    (e.g., "1. Customer management, 2. Order processing")
For each feature:
  Q6a: Brief description?
  Q6b: Must Have / Should Have / Could Have?

SECTION 4 — Data
Q7: What are the main data entities?
    (e.g., "Customer, Order, Product, Invoice")
For each entity:
  Q7a: Key attributes?
  Q7b: How does it relate to other entities?

SECTION 5 — Integrations
Q8: Does this app integrate with any other systems?
    (e.g., "Payment gateway, email service, legacy system")

SECTION 6 — Constraints
Q9: Any specific compliance requirements?
    (e.g., "APRA CPS 234, PCI DSS, Privacy Act")
Q10: Any out-of-scope items to document?

SECTION 7 — Performance
Q11: Any specific performance targets?
     (Press Enter to use PPCC standard defaults)
```

---

## Output Format

### Generate the Spec File

After collecting information (any mode), generate the file:

```markdown
# Functional Specification: {APP_NAME}

> **Generated by**: /create-functional-spec ({mode})
> **Source**: {source document path / "reverse-engineered from code" / "interactive"}
> **Generated**: {date}
> **Review required**: {list of PLACEHOLDER sections}
> Last updated: {date}

---

## 1. Vision

### Problem Statement
{extracted or inferred — mark confidence}

### Target Users
{extracted or inferred}

### Business Value
{extracted or inferred or PLACEHOLDER}

---

## 2. Users and Roles
{populated table — mark inferred roles}

---

## 3. Core Features
{populated from document or code — mark status}

---
[... all sections from template ...]
```

### Post-Generation Report

After writing the file, output:

```
## ✅ Functional Specification Created

**Files**:
- `specs/functional-specifications.md`
**Mode**: {mode used}
**Source**: {source}

### Coverage Summary
| Section | Status | Confidence |
|---|---|---|
| Vision | ✅ Complete | High / Medium / Low |
| Users & Roles | ✅ Complete | High |
| Core Features | ✅ {N} features | High |
| NFRs | ⚠️ Defaults used | Medium |
| Domain Model | ✅ {N} entities | High |
| Integrations | ✅ {N} found | Medium |
| Constraints | ⚠️ Partial | Low |
| Open Questions | ✅ {N} items | — |

### Items Requiring Human Review
<!-- Sections marked PLACEHOLDER or REVIEW -->
1. [Section]: [what needs review]
2. [Section]: [what needs review]

### Recommended Next Steps
1. Review all <!-- REVIEW --> and <!-- PLACEHOLDER --> comments
2. Fill in any missing business context
3. Run /requirements-analyze to extract detailed requirements
4. Run /story-create to generate user stories
5. Run /design-architecture to design the system
```

---

## Validation

Before saving, verify the generated spec:

- [ ] App name is not `[Application Name]`
- [ ] At least one feature is documented
- [ ] At least one user role is defined
- [ ] Tech stack section reflects actual stack found
- [ ] No section is completely empty
- [ ] Open questions list captures real ambiguities found

If validation fails on critical fields → ask user to provide
missing values before saving.

---

## File Lock Check

Before writing, check if spec already exists:

```bash
!`ls specs/functional-specifications.md 2>/dev/null && echo "SPEC_EXISTS" || echo "SPEC_NEW"`
```

If file EXISTS:

```
⚠️  Existing functional specification file detected:
   specs/functional-specifications.md

Options:
1. Overwrite — replace with newly generated spec
2. Merge — add missing sections only, keep existing content
3. Create backup — save existing as functional-specifications.backup.md
   then overwrite
4. Cancel — do not make changes

Which option? (default: 3 — create backup then overwrite)
```

---

## Cross-References

- Output used by: all commands in `.claude/commands/`
- Template basis: `.claude/templates/functional-specifications.md`
- Diagram standard (binding): `@.claude/standards/mermaid-standards.md`
- Diagram authoring examples: `.claude/commands/diagram-create.md`
- Prefer `/create-specifications` when business requirements should be generated together
- After running this: `/requirements-analyze`, `/story-create`
- Framework index: `.claude/README.md`
