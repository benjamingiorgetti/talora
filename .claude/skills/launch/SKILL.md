---
name: launch
description: "Start the full Talora development environment. Checks .env, installs dependencies, starts Docker containers, runs migrations, and launches backend + frontend servers."
user_invocable: true
---

Run the following checklist to launch the Talora development environment. Stop and report if any step fails.

## Step 0: Sync with main

Pull latest changes and merge `main` into the current branch to stay up to date:

1. Run `git fetch origin`
2. Run `git merge origin/main --no-edit`
3. If the merge has conflicts, stop and report them to the user — do NOT auto-resolve.

## Step 1: Copy and verify .env files

Conductor workspaces are git worktrees — `.env` files (gitignored) are never present in new workspaces.
The canonical `.env` files live in the original repo.

**Auto-copy logic** (do this silently, no need to ask the user):

1. **Backend .env** (`apps/backend/.env`):
   - If missing, copy from `/Users/benjamingiorgetti/Documents/not Galo/talora/apps/backend/.env`
   - If that source is also missing, copy from `.env.example` and warn the user to fill in secrets

2. **Frontend .env** (`apps/frontend/.env`):
   - If missing, copy from `/Users/benjamingiorgetti/Documents/not Galo/talora/apps/frontend/.env`
   - If that source is also missing, skip (frontend works without it)

After copying, verify the backend `.env` has ALL required keys with non-empty values:
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_API_URL` (must be `http://localhost:3001`)
- `NEXT_PUBLIC_WS_URL` (must be `ws://localhost:3001`)

## Step 2: Install dependencies
Run `bun install` in the project root.

## Step 3: Start Docker containers
Run `docker-compose up -d` to start PostgreSQL and Evolution API.
Wait a few seconds, then verify containers are running with `docker-compose ps`.

## Step 4: Run database migrations
Run `cd apps/backend && bun run migrate`.

## Step 5: Start backend
Run `cd apps/backend && bun run dev` in background (port 3001).
Verify it responds: `curl -s http://localhost:3001/auth/login -o /dev/null -w '%{http_code}'`

## Step 6: Start frontend
Run `cd apps/frontend && bun run dev` in background (port 3000).
Verify it responds: `curl -s http://localhost:3000 -o /dev/null -w '%{http_code}'`

## Step 7: Report status
Print a summary of what's running:
- Docker containers status
- Backend URL: http://localhost:3001
- Frontend URL: http://localhost:3000
- Any warnings or issues found
