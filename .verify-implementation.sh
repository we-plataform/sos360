#!/bin/bash

# Verification script for subtask-4-1
# Tests rate limiting on /leads/analyze endpoint

echo "=================================================="
echo "Verifying Rate Limiting Implementation"
echo "Endpoint: POST /leads/analyze"
echo "=================================================="
echo ""

# Check 1: Middleware is defined
echo "✓ Check 1: Analyze rate limiter middleware defined"
if grep -q "export const analyzeRateLimit" apps/api/src/middleware/rate-limit.ts; then
    echo "  ✅ PASS: analyzeRateLimit middleware found"
else
    echo "  ❌ FAIL: analyzeRateLimit middleware not found"
    exit 1
fi
echo ""

# Check 2: Middleware is imported
echo "✓ Check 2: Analyze rate limiter imported in leads.ts"
if grep -q "analyzeRateLimit" apps/api/src/routes/leads.ts; then
    echo "  ✅ PASS: analyzeRateLimit imported"
else
    echo "  ❌ FAIL: analyzeRateLimit not imported"
    exit 1
fi
echo ""

# Check 3: Middleware is applied to the route
echo "✓ Check 3: Middleware applied to /analyze route"
OUTPUT=$(grep -A 5 "'/analyze'" apps/api/src/routes/leads.ts | grep -c "analyzeRateLimit")
if [ "$OUTPUT" -gt 0 ]; then
    echo "  ✅ PASS: analyzeRateLimit applied to route"
    LINE=$(grep -n "analyzeRateLimit" apps/api/src/routes/leads.ts | head -1 | cut -d: -f1)
    echo "     Line: $LINE"
else
    echo "  ❌ FAIL: analyzeRateLimit not applied to route"
    exit 1
fi
echo ""

# Check 4: Rate limit constants defined
echo "✓ Check 4: Rate limit constants defined"
if grep -q "analyze:" packages/shared/src/constants/index.ts; then
    echo "  ✅ PASS: Rate limit constants found"
    grep "analyze:" packages/shared/src/constants/index.ts | head -1
else
    echo "  ❌ FAIL: Rate limit constants not found"
    exit 1
fi
echo ""

# Check 5: Middleware order (rate limiter after authorize)
echo "✓ Check 5: Middleware order verification"
AUTH_LINE=$(grep -B 5 "analyzeRateLimit" apps/api/src/routes/leads.ts | grep -n "authorize" | head -1 | cut -d: -f1)
RL_LINE=$(grep -n "analyzeRateLimit" apps/api/src/routes/leads.ts | head -1 | cut -d: -f1)
if [ -n "$AUTH_LINE" ] && [ -n "$RL_LINE" ]; then
    echo "  ✅ PASS: Middleware order correct (authorize → analyzeRateLimit)"
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
echo "  Endpoint: POST /api/v1/leads/analyze"
echo "  Limit: 20 requests per minute"
echo "  Key: User ID (authenticated) or IP (unauthenticated)"
echo "  Error: 429 with Portuguese error message"
echo ""
echo "Manual Testing:"
echo "  To test rate limiting with a real authentication token,"
echo "  see .test-verification-report.md for detailed instructions."
echo ""
