---
name: integrate
description: "Scaffold a new API or library integration. Fetches docs, asks clarification questions, generates a plan, and scaffolds client wrapper, types, and route handlers. Usage: /integrate <api-or-library>"
user_invocable: true
---

Scaffold a new external API or library integration into the project. The user provides `<api-or-library>` as an argument.

If no argument is provided, ask: "What API or library do you want to integrate?"

## Step 1: Research the API/Library

Launch 2 agents in parallel:

**Agent A (Explore):** Search the existing codebase for any prior usage or references to this API/library. Check `package.json` files, imports, and existing client wrappers in `apps/backend/src/`.

**Agent B (general-purpose):** Fetch documentation for the API/library:
- Try context7 `resolve-library-id` + `query-docs` first
- Fall back to web search if context7 doesn't have it
- Identify: authentication method, base URL, key endpoints, rate limits, response formats

## Step 2: Ask Clarification Questions

Based on the research, ask 8-12 clarification questions:
- Which specific features/endpoints do you need?
- What's the authentication method? Do you already have API keys?
- Should this be exposed through the admin panel or only used internally?
- What error handling strategy? (retry, fallback, fail-fast)
- Do you need real-time updates (webhooks) or polling?
- Should responses be cached? For how long?
- What types/interfaces already exist in `@talora/shared` that relate to this?
- Are there rate limits we need to respect?
- Should this integrate with the existing agent tool system?
- What's the priority: quick MVP or production-ready?

**Wait for user answers before proceeding.**

## Step 3: Generate Integration Plan

Based on answers, create a detailed plan listing:
- Files to create/modify
- Types to add to `packages/shared/src/index.ts`
- Client wrapper location: `apps/backend/src/<service>/client.ts`
- Route handlers if needed
- Environment variables to add to `.env.example`
- Agent assignments (which custom agent handles which file)

Present the plan and wait for approval.

## Step 4: Scaffold

Launch parallel agents to implement:

1. **Types**: Add interfaces/types to `packages/shared/src/index.ts`
2. **Client wrapper**: Create `apps/backend/src/<service>/client.ts` with:
   - Typed client class/functions
   - Authentication handling
   - Error normalization (wrap API errors into consistent format)
   - Timeout and retry logic
   - Rate limit awareness
3. **Config**: Add env vars to `apps/backend/src/config.ts` and `.env.example`
4. **Routes** (if needed): Create `apps/backend/src/api/<service>.ts`
5. **Frontend** (if needed): Add API calls and UI components

## Step 5: Verify

- Run `cd apps/backend && bunx tsc --noEmit` to verify types compile
- Verify all new env vars are documented in `.env.example`
- Confirm the client wrapper follows the project's integration patterns (timeout + retry + error normalization)
