---
name: test-bug
description: "Reproduce a bug as a failing test first, then fix it with subagents. Use when the user reports a bug: 'no funciona', 'se rompe', 'tira error', or similar."
user_invocable: true
---

When a bug is reported, follow this workflow strictly. Do NOT skip to fixing.

## Phase 1: Understand the Bug

1. Ask the user to describe the bug if not already clear (what they did, what they expected, what happened instead)
2. Identify the affected area (backend route, frontend component, integration)
3. Read the relevant code to understand the current behavior

## Phase 2: Write a Failing Test

1. Determine the right test file:
   - Backend: `apps/backend/src/<area>/__tests__/<file>.test.ts` or co-located `<file>.test.ts`
   - Use existing test helpers from `apps/backend/src/__test-utils__/`
2. Write a test that:
   - Clearly names the bug (e.g., `it("should not return 500 when company has no professionals")`)
   - Reproduces the exact conditions that trigger the bug
   - Asserts the EXPECTED behavior (which should fail with current code)
3. Run the test to confirm it FAILS:
   ```bash
   cd apps/backend && bun test src/path/to/file.test.ts
   ```
4. If the test passes, the bug isn't reproduced — investigate further before proceeding

## Phase 3: Fix with Subagents

Launch **2 agents in parallel**:

### Agent 1: Fix the Code
- Read the failing test to understand the exact failure
- Identify the minimal code change that fixes the bug
- Make the fix
- Run the specific test to verify it passes
- Run the full test suite to check for regressions: `cd apps/backend && bun run test`

### Agent 2: Review the Fix
- Read the test and the proposed fix
- Check for edge cases the test doesn't cover
- Add additional test cases if needed
- Run typecheck: `cd apps/backend && bun run typecheck`

## Phase 4: Report

```
BUG FIX REPORT
==============
Bug: [description]
Test: [file path and test name]
Fix: [what was changed and why]
Regression: [test suite results]
Confidence: [HIGH/MEDIUM/LOW — based on test coverage of the fix]
```

## If No Test Harness Exists

If the bug is in an area without test infrastructure (e.g., frontend component, Evolution webhook):
1. State explicitly: "No test harness for this area"
2. Write the closest approximation (integration test, curl script, manual repro steps)
3. Still fix with the same agent pattern
4. Flag as a gap to add test coverage later
