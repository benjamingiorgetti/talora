---
name: rename
description: "Rename a project, brand, or identifier across the entire codebase. Searches all files for the old name (case-insensitive), previews changes, applies replacements, and runs type-check to verify nothing broke. Usage: /rename <old-name> <new-name>"
user_invocable: true
---

Rename all occurrences of a name/brand/identifier across the entire codebase. The user provides `<old-name>` and `<new-name>` as arguments.

If no arguments are provided, ask the user: "What name should I replace, and what's the new name?"

## Step 1: Search for all occurrences

Search the entire codebase for the old name in all variations:
- Exact case: `old-name`
- lowercase: `old-name` (lowercased)
- UPPERCASE: `OLD-NAME` (uppercased)
- PascalCase/camelCase variations
- kebab-case variations (for package names)

Search in these file types: `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.md`, `*.yml`, `*.yaml`, `*.env*`, `*.css`, `Dockerfile*`, `Caddyfile`

Use Grep to find all occurrences and group them by file.

## Step 2: Preview changes

Present a summary to the user:
```
RENAME PREVIEW: "old-name" → "new-name"
================================
Files affected: X
Total replacements: Y

By file:
  - package.json (3 occurrences)
  - AGENTS.md (5 occurrences)
  - apps/backend/src/config.ts (2 occurrences)
  ...
```

**Wait for user confirmation before proceeding.**

## Step 3: Apply replacements

Use the Edit tool to apply all replacements. Process files in this order:
1. `package.json` files (root and workspace packages)
2. Configuration files (`.env*`, `docker-compose*.yml`, `Caddyfile`)
3. `AGENTS.md` and other markdown files
4. Source code files (`.ts`, `.tsx`, `.js`)
5. Other files

## Step 4: Verify

Run type-checks to ensure nothing broke:
```bash
cd apps/backend && bunx tsc --noEmit
cd apps/frontend && bunx tsc --noEmit
```

If there are errors, attempt to fix them. If unfixable, report them to the user.

## Step 5: Summary

Report what was changed:
```
RENAME COMPLETE: "old-name" → "new-name"
=========================================
Files modified: X
Total replacements: Y
Type-check: PASS/FAIL
```
