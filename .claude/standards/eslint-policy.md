# ESLint Non-Negotiable Configuration Policy

## Purpose

This policy ensures that critical ESLint plugins and rules remain enabled to protect code quality, accessibility, and security. Agents must not remove these settings without explicit user confirmation and documented justification.

---

## Locked Plugins (NEVER Remove)

### 1. `react`
- **Purpose**: Enforces React best practices
- **Detects**:
  - Missing display names on components
  - Incorrect prop validation
  - React lifecycle method issues
  - Deprecated patterns
- **Impact if disabled**: Components lose pattern validation; subtle bugs in React logic go undetected

### 2. `react-hooks`
- **Purpose**: Enforces Rules of Hooks
- **Detects**:
  - Hooks called conditionally or in loops (critical React violation)
  - Missing dependencies in useEffect/useCallback
  - Hook-calling code that violates React rules
- **Impact if disabled**: CRITICAL — Stale closures, hard-to-debug state bugs, memory leaks in useEffect

### 3. `jsx-a11y`
- **Purpose**: Ensures accessibility compliance (WCAG 2.1 AA standard)
- **Detects**:
  - Missing `alt` text on images
  - Non-interactive elements used as buttons
  - Missing ARIA labels
  - Keyboard navigation issues
  - Color contrast problems (some rules)
- **Impact if disabled**: Accessibility violations; PPCC fails WCAG compliance; excludes users with disabilities

### 4. `security`
- **Purpose**: Detects OWASP security vulnerabilities
- **Detects**:
  - XSS vulnerabilities (dangerous innerHTML, eval, etc.)
  - Injection vulnerabilities
  - Prototype pollution patterns
  - Unsafe regular expressions
- **Impact if disabled**: Potential security vulnerabilities shipped to production

---

## Locked Rule Overrides (NEVER Disable)

### `'no-unused-vars': 'off'`

**Why disabled**:
- TypeScript discriminated unions require intentional unused variables for type narrowing:
  ```typescript
  type Action =
    | { type: 'CREATE'; payload: { name: string } }
    | { type: 'DELETE'; userId: string };

  // Unused 'payload' is intentional — part of discriminated union
  const handler = (action: Action) => {
    switch (action.type) {
      case 'CREATE':
        const { type, payload } = action; // payload used in later logic
        break;
      case 'DELETE':
        const { type, userId } = action; // payload not used here
        break;
    }
  };
  ```
- Handler destructuring for clarity:
  ```typescript
  const addEventListener = (handler: (event: Event) => void) => {
    // 'event' may be unused, but declared for clarity
  };
  ```

**Impact if enabled**: Frequent false positives in TypeScript patterns; noisy lint warnings mask real issues

---

## Agent Behavioral Contract

### Scenario 1: Quality Gate Suggests Removal

**Before**: "Removing `react-hooks` plugin to fix X..."

**Required action**:
1. **STOP — Do not remove without asking**
2. **Notify user with details**:
   ```
   ⚠️ Quality gate is suggesting removal of `react-hooks` plugin.
   Reason: [specific reason]
   Impact: [what will break]
   Alternative solutions: [other ways to fix]

   Shall I proceed with removal? (Y/N)
   ```
3. **Wait for explicit user approval (Y/N)**
4. If user approves:
   - Document reason in commit message
   - Remove temporarily
   - **Restore immediately after the related work is complete**
   - Verify ESLint passes with plugins restored

### Scenario 2: Plugin Accidentally Removed During Refactor

**Action after discovery**:
1. **Flag as quality gate FAILURE** (not a successful fix)
2. **Restore plugins immediately**
3. **Notify user**:
   ```
   ❌ Quality Gate Failure: ESLint plugins were removed during refactoring.
   Removed: [list of plugins]
   Reason: [why they were removed]
   Action taken: Restored all plugins.

   Please review the work to ensure quality standards are met.
   ```

### Scenario 3: New Quality Gate Conflict

**When a NEW quality gate contradicts ESLint policy**:
1. **Escalate, don't compromise**
2. Example: If new security scanner conflicts with `security` plugin:
   > "New security gate conflicts with `security` ESLint plugin. Cannot remove ESLint plugin — must resolve conflict in quality gate configuration instead."
3. **Propose alternative solution** (e.g., adjust new gate's config, suppress specific false positive in gate, not in ESLint)

---

## Implementation Checklist for Developers

When working with this codebase:

- [ ] Read this policy before making ESLint configuration changes
- [ ] If quality gate suggests removing a locked plugin, ask before proceeding
- [ ] If temporarily removing a plugin, set a reminder to restore it
- [ ] Document any exceptions in the PR description
- [ ] Run `pnpm lint` to verify all plugins are active before committing
- [ ] If new linting violations appear after plugin restoration, address them in code rather than disabling the plugin

---

## Quick Reference: ESLint Plugin Status Check

```bash
# Verify all plugins are installed and active
cat apps/web/eslint.config.mjs | grep 'plugins' -A 10

# Check for disabled rules (should be minimal)
cat apps/web/eslint.config.mjs | grep -i 'no-unused-vars'
```

**Expected output**:
```javascript
plugins: {
  '@typescript-eslint': typescriptEslint,
  react,
  'react-hooks': reactHooks,
  'jsx-a11y': jsxA11y,
  security,
},

'no-unused-vars': 'off'
```

---

## Related Standards

- **TypeScript Formatting**: `.claude/standards/typescript-formatting-standards.md#eslint-configuration---non-negotiable-rules`
- **PPCC Critical Constraints**: `.claude/CLAUDE.md#critical-constraints`
- **Code Quality**: `docs/code-quality-and-formatting.md`

## Token Optimization

- **Load when**: configuring or modifying lint rules; investigating lint regressions.
- **Load only**: this policy + `typescript-formatting-standards.md`. Skip implementation standards.
- **Unload after**: lint config stable; `pnpm lint` returns zero warnings.
