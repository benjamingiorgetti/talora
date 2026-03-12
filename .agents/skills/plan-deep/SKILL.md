---
name: plan-deep
description: "Deep planning workflow with mandatory clarification questions. Explores the codebase, asks 10-15 clarification questions, waits for answers, then builds a detailed implementation plan with parallel agent assignments."
user_invocable: true
---

Run a deep planning workflow for a feature or change. This is the thorough planning mode — use it for non-trivial features.

## Step 1: Understand the Request

Read the user's request carefully. Identify:
- What is being asked for (feature, refactor, fix, integration)
- Which parts of the codebase are likely involved
- What the user hasn't specified yet

## Step 2: Explore the Codebase

Launch **2 Explore agents in parallel**:

**Agent A:** Explore backend code related to the request. Read relevant files in `apps/backend/src/`, check database schema, review existing patterns.

**Agent B:** Explore frontend code related to the request. Read relevant files in `apps/frontend/src/`, check existing components and pages, review API client usage.

## Step 3: Generate Clarification Questions

Based on the exploration results, generate **10-15 clarification questions** organized by category:

### Scope & Requirements
- What exactly should happen when...?
- Should this work for X scenario?
- What's the expected behavior when...?

### Technical Decisions
- Should we use X approach or Y approach?
- Should this be a new API endpoint or extend an existing one?
- Should this data be cached?

### Edge Cases
- What happens if the user does X?
- How should we handle the case where...?
- Should there be a limit on...?

### UX & Design
- What should the UI look like for this?
- Should there be a loading state?
- How should errors be displayed?

### Priority & Scope
- Is this MVP or production-ready?
- Should we handle all cases now or start simple?
- Any hard deadlines or dependencies?

**Present all questions and WAIT for the user to answer before proceeding.**

## Step 4: Build Implementation Plan

After receiving answers, create a detailed plan:

```
IMPLEMENTATION PLAN: [Feature Name]
====================================

## Overview
[2-3 sentence summary of what will be built]

## Files to Create
- `path/to/new/file.ts` — [purpose]

## Files to Modify
- `path/to/existing/file.ts` — [what changes]

## Database Changes
- [new tables, columns, indexes, or migrations needed]

## Shared Types
- [new types to add to packages/shared/src/index.ts]

## Implementation Steps (ordered)

### Phase 1: [Foundation]
**Agent: [agent-name]**
1. [specific step]
2. [specific step]

### Phase 2: [Core Logic]
**Agent: [agent-name]** (parallel with Phase 3)
1. [specific step]

### Phase 3: [UI]
**Agent: [agent-name]** (parallel with Phase 2)
1. [specific step]

### Phase 4: [Integration & Testing]
**Agent: [agent-name]**
1. [specific step]

## Risks & Considerations
- [potential issue and mitigation]

## Verification Checklist
- [ ] Type-check passes
- [ ] All new env vars documented
- [ ] UI renders correctly
- [ ] API endpoints respond correctly
- [ ] Edge cases handled
```

**Present the plan and wait for user approval before implementing.**
