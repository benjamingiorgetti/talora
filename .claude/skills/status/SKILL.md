---
name: status
description: "Quick health dashboard showing Docker containers, ports, backend health, Evolution API state, and frontend status. Use when you want a fast overview of what's running."
user_invocable: true
---

Run a fast health check of the entire Talora development environment. Print results as a dashboard.

## Checks (run all in parallel where possible)

### 1. Docker Containers
```bash
docker-compose ps 2>/dev/null || echo "Docker Compose not running"
```

### 2. Port Status
Check ports 3000, 3001, 5432 (or 5433), 8080:
```bash
for port in 3000 3001 5432 5433 8080; do
  pid=$(lsof -i :$port -t 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    name=$(ps -p $pid -o comm= 2>/dev/null)
    echo "  :$port → $name (PID $pid)"
  else
    echo "  :$port → FREE"
  fi
done
```

### 3. Backend Health
```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool 2>/dev/null || echo "Backend not responding"
```

### 4. Evolution API Status
Read `EVOLUTION_API_KEY` from `apps/backend/.env`, then:
```bash
curl -s http://localhost:8080/instance/fetchInstances -H "apikey: $KEY" 2>/dev/null || echo "Evolution API not responding"
```

### 5. Frontend Status
```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo "Frontend not responding"
```

## Output Format

```
TALORA STATUS
=============
Docker:     [UP] postgres, evolution-api  |  [DOWN] none
Ports:      :3000 → next-server  :3001 → bun  :5433 → postgres  :8080 → evolution
Backend:    [OK] healthy — DB connected, Evolution reachable
Evolution:  [OK] 1 instance (connected) | [WARN] 0 instances
Frontend:   [OK] responding (200)

Issues: none | [list any problems found]
```
