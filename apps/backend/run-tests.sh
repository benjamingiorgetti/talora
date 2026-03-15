#!/usr/bin/env bash
# Run each test file in its own bun process to avoid mock.module leakage.
# bun:test shares module cache across files in a single run, causing
# mock.module registrations from one file to interfere with others.

set -euo pipefail

export DATABASE_URL=postgresql://test:test@localhost/test
export JWT_SECRET=test-secret
export ADMIN_EMAIL=test@test.com
export ADMIN_PASSWORD=test
export EVOLUTION_API_URL=http://localhost:8080
export EVOLUTION_API_KEY=test-key
export OPENAI_API_KEY=test-key

PASS=0
FAIL=0
TOTAL=0
FAILED_FILES=()

for f in $(find src -name '*.test.ts' -not -path '*/node_modules/*' | sort); do
  TOTAL=$((TOTAL + 1))
  if bun test "$f" > /dev/null 2>&1; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    FAILED_FILES+=("$f")
    # Re-run to show output
    echo "FAIL: $f"
    bun test "$f" 2>&1 | grep -E "(fail|error)" | head -5
    echo ""
  fi
done

echo "================================"
echo "Files: $TOTAL | Pass: $PASS | Fail: $FAIL"
if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo "Failed files:"
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi
echo "All test files passed!"
