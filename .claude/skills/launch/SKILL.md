---
name: launch
description: "Start the full bottoo development environment. Checks .env, installs dependencies, starts Docker containers, runs migrations, and launches backend + frontend servers."
user_invocable: true
---

Run the following checklist to launch the bottoo development environment. Stop and report if any step fails.

## Step 1: Verify .env
Read `.env` in the project root. Compare against `.env.example` and verify ALL required keys have non-empty values:
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_API_URL` (must be `http://localhost:3001`)
- `NEXT_PUBLIC_WS_URL` (must be `ws://localhost:3001`)

If `.env` doesn't exist, copy from `.env.example` and warn the user to fill in the values.

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
