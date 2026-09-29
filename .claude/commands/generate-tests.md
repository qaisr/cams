---
name: generate-tests
description: >
  Scan a module or directory, analyse all source files, and generate
  complete test suites (unit + integration) from scratch. Ideal for
  modules that have zero test coverage or for bootstrapping tests
  on an existing codebase.
version: 1.0.0
agent: test-engineer
arguments:
  - name: TARGET
    required: true
    description: Module path or directory to scan
    examples:
      - "apps/api/src/modules/users"
      - "apps/web/src/components/bookings"
      - "apps/api/src/modules/"  (all modules)
---

# Generate Tests

Scan → Analyse → Generate → Verify.

## Input
$ARGUMENTS

---

## Step 1 — Discover Source Files

```bash
TARGET="${1:-apps/api/src/modules}"

echo "=== Source files in $TARGET ==="
find "$TARGET" -type f \( -name "*.service.ts" -o -name "*.controller.ts" \
  -o -name "*.tsx" -o -name "*.gateway.ts" \) \
  ! -path "*/node_modules/*" \
  ! -name "*.spec.ts" \
  ! -name "*.test.tsx"

echo "=== Existing test files ==="
find "$TARGET" -type f \( -name "*.spec.ts" -o -name "*.test.tsx" \)
```

---

## Step 2 — Triage

For each source file found:

```
┌─────────────────────────────────────────────────┐
│ FILE: {path}                                    │
│ Type: Service / Controller / Component / Hook   │
│ Test exists: Yes / No                           │
│ Action: Generate / Skip / Augment               │
└─────────────────────────────────────────────────┘
```

Show triage table and ask:

```
Found [n] files needing tests:
  [n] services     → unit tests
  [n] controllers  → unit tests
  [n] components   → RTL tests
  [n] hooks        → hook tests
  [n] modules      → integration tests needed

Generate all? [Y/N/S (selective)]
```

**[WAIT FOR USER INPUT]**

---

## Step 3 — Generate in Priority Order

Priority order:
1. Fixture factories (required by everything else)
2. Service unit tests (business logic — highest value)
3. Controller unit tests (HTTP semantics)
4. Integration tests (one per module)
5. Component tests
6. Hook tests

For each file:
1. Read source file
2. Identify all public API
3. Enumerate all branches
4. Create fixture factory if missing
5. Generate test file using appropriate template
6. Run generated tests — fix failures

---

## Step 4 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated  : [n] test files
Tests added: [n] test cases
Passed     : [n]
Failed     : [n] (investigate — do not ship failing tests)
Coverage   : before → after

Files created:
  [list of new test files]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Cross-References
- Standards: `@.claude/standards/testing-standards.md`
- Coverage audit: `/test-coverage-audit`
- Agent: `@.claude/agents/test-engineer.md`
