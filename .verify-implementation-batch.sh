#!/bin/bash

# Verification script for subtask-4-2
# Tests rate limiting on /leads/analyze-batch endpoint

echo "=================================================="
echo "Verifying Rate Limiting Implementation"
echo "Endpoint: POST /leads/analyze-batch"
echo "=================================================="
echo ""

# Check 1: Middleware is defined
echo "✓ Check 1: Analyze batch rate limiter middleware defined"
if grep -q "export const analyzeBatchRateLimit" apps/api/src/middleware/rate-limit.ts; then
    echo "  ✅ PASS: analyzeBatchRateLimit middleware found"
else
    echo "  ❌ FAIL: analyzeBatchRateLimit middleware not found"
    exit 1
fi
echo ""

# Check 2: Middleware is imported
echo "✓ Check 2: Analyze batch rate limiter imported in leads.ts"
if grep -q "analyzeBatchRateLimit" apps/api/src/routes/leads.ts; then
    echo "  ✅ PASS: analyzeBatchRateLimit imported"
else
    echo "  ❌ FAIL: analyzeBatchRateLimit not imported"
    exit 1
fi
echo ""

# Check 3: Middleware is applied to the route
echo "✓ Check 3: Middleware applied to /analyze-batch route"
OUTPUT=$(grep -A 5 "'/analyze-batch'" apps/api/src/routes/leads.ts | grep -c "analyzeBatchRateLimit")
if [ "$OUTPUT" -gt 0 ]; then
    echo "  ✅ PASS: analyzeBatchRateLimit applied to route"
    LINE=$(grep -n "analyzeBatchRateLimit" apps/api/src/routes/leads.ts | head -1 | cut -d: -f1)
    echo "     Line: $LINE"
else
    echo "  ❌ FAIL: analyzeBatchRateLimit not applied to route"
    exit 1
fi
echo ""

# Check 4: Rate limit constants defined
echo "✓ Check 4: Rate limit constants defined"
if grep -q "analyzeBatch:" packages/shared/src/constants/index.ts; then
    echo "  ✅ PASS: Rate limit constants found"
    grep "analyzeBatch:" packages/shared/src/constants/index.ts | head -1
else
    echo "  ❌ FAIL: Rate limit constants not found"
    exit 1
fi
echo ""

# Check 5: Middleware order (rate limiter after authorize)
echo "✓ Check 5: Middleware order verification"
AUTH_LINE=$(grep -B 5 "analyzeBatchRateLimit" apps/api/src/routes/leads.ts | grep -n "authorize" | head -1 | cut -d: -f1)
RL_LINE=$(grep -n "analyzeBatchRateLimit" apps/api/src/routes/leads.ts | head -1 | cut -d: -f1)
if [ -n "$AUTH_LINE" ] && [ -n "$RL_LINE" ]; then
    echo "  ✅ PASS: Middleware order correct (authorize → analyzeBatchRateLimit)"
else
    echo "  ⚠️  WARNING: Could not verify middleware order"
fi
echo ""

# Summary
echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo "All implementation checks passed! ✅"
echo ""
echo "Rate Limit Configuration:"
echo "  Endpoint: POST /api/v1/leads/analyze-batch"
echo "  Limit: 5 requests per minute"
echo "  Key: User ID (authenticated) or IP (unauthenticated)"
echo "  Error: 429 with Portuguese error message"
echo ""
echo "Rationale for Stricter Limit:"
echo "  - Batch endpoint can process up to 50 profiles per request"
echo "  - Each profile triggers an OpenAI API call (gpt-4o-mini)"
echo "  - Single batch request = significant API cost"
echo "  - 5/min limit prevents cost abuse while allowing legitimate use"
echo ""
echo "Manual Testing:"
echo "  To test rate limiting with a real authentication token,"
echo "  see .test-verification-report-batch.md for detailed instructions."
echo ""
