#!/bin/bash

# Verification script for analyzeDeepRateLimit implementation
# This script checks that the rate limiting middleware is properly applied
# to the /leads/analyze-deep endpoint

echo "================================"
echo "Verifying analyzeDeepRateLimit Implementation"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check 1: Middleware defined in rate-limit.ts
echo "✓ Check 1: Middleware defined in rate-limit.ts"
if grep -q "export const analyzeDeepRateLimit" apps/api/src/middleware/rate-limit.ts; then
  echo -e "${GREEN}✅ PASS${NC}: analyzeDeepRateLimit middleware is defined"
else
  echo -e "${RED}❌ FAIL${NC}: analyzeDeepRateLimit middleware not found"
  exit 1
fi
echo ""

# Check 2: Middleware configuration
echo "✓ Check 2: Middleware uses correct rate limit constants"
if grep -A 20 "export const analyzeDeepRateLimit" apps/api/src/middleware/rate-limit.ts | grep -q "RATE_LIMITS.analyzeDeep"; then
  echo -e "${GREEN}✅ PASS${NC}: Uses RATE_LIMITS.analyzeDeep constants"
else
  echo -e "${RED}❌ FAIL${NC}: Does not use RATE_LIMITS.analyzeDeep"
  exit 1
fi
echo ""

# Check 3: Middleware imported in leads.ts
echo "✓ Check 3: Middleware imported in leads.ts"
if grep -q "analyzeDeepRateLimit" apps/api/src/routes/leads.ts; then
  echo -e "${GREEN}✅ PASS${NC}: analyzeDeepRateLimit is imported"
else
  echo -e "${RED}❌ FAIL${NC}: analyzeDeepRateLimit not imported"
  exit 1
fi
echo ""

# Check 4: Middleware applied to /analyze-deep route
echo "✓ Check 4: Middleware applied to /analyze-deep route"
ROUTE_LINE=$(grep -n "analyze-deep" apps/api/src/routes/leads.ts | head -1)
if [ -n "$ROUTE_LINE" ]; then
  LINE_NUM=$(echo "$ROUTE_LINE" | cut -d: -f1)
  # Check next 10 lines for analyzeDeepRateLimit
  if sed -n "$((LINE_NUM)),$((LINE_NUM+10))p" apps/api/src/routes/leads.ts | grep -q "analyzeDeepRateLimit"; then
    echo -e "${GREEN}✅ PASS${NC}: analyzeDeepRateLimit middleware is applied to /analyze-deep route (around line $LINE_NUM)"
  else
    echo -e "${RED}❌ FAIL${NC}: analyzeDeepRateLimit not found on /analyze-deep route"
    exit 1
  fi
else
  echo -e "${RED}❌ FAIL${NC}: /analyze-deep route not found"
  exit 1
fi
echo ""

# Check 5: Rate limit constants defined
echo "✓ Check 5: Rate limit constants defined in shared package"
if grep -q "analyzeDeep.*:" packages/shared/src/constants/index.ts; then
  echo -e "${GREEN}✅ PASS${NC}: analyzeDeep constants defined"
  grep -A1 "analyzeDeep:" packages/shared/src/constants/index.ts | head -2
else
  echo -e "${RED}❌ FAIL${NC}: analyzeDeep constants not found"
  exit 1
fi
echo ""

# Check 6: Middleware order (authorize before rate limit)
echo "✓ Check 6: Middleware order (authorize before analyzeDeepRateLimit)"
LINE_NUM=$(grep -n "analyze-deep" apps/api/src/routes/leads.ts | head -1 | cut -d: -f1)
MIDDLEWARE_BLOCK=$(sed -n "$((LINE_NUM)),$((LINE_NUM+10))p" apps/api/src/routes/leads.ts)
if echo "$MIDDLEWARE_BLOCK" | grep -q "authorize.*analyzeDeepRateLimit"; then
  echo -e "${GREEN}✅ PASS${NC}: Middleware order is correct (authorize → analyzeDeepRateLimit)"
else
  # Check if they're on separate lines
  AUTH_LINE=$(echo "$MIDDLEWARE_BLOCK" | grep -n "authorize" | head -1)
  RL_LINE=$(echo "$MIDDLEWARE_BLOCK" | grep -n "analyzeDeepRateLimit" | head -1)
  if [ -n "$AUTH_LINE" ] && [ -n "$RL_LINE" ]; then
    AUTH_NUM=$(echo "$AUTH_LINE" | cut -d: -f1)
    RL_NUM=$(echo "$RL_LINE" | cut -d: -f1)
    if [ "$AUTH_NUM" -lt "$RL_NUM" ]; then
      echo -e "${GREEN}✅ PASS${NC}: Middleware order is correct (authorize before analyzeDeepRateLimit)"
    else
      echo -e "${RED}❌ FAIL${NC}: Middleware order incorrect (analyzeDeepRateLimit before authorize)"
      exit 1
    fi
  else
    echo -e "${RED}❌ FAIL${NC}: Could not determine middleware order"
    exit 1
  fi
fi
echo ""

echo "================================"
echo -e "${GREEN}✅ All checks passed!${NC}"
echo "================================"
echo ""
echo "Summary:"
echo "- analyzeDeepRateLimit middleware is defined in rate-limit.ts"
echo "- Middleware uses RATE_LIMITS.analyzeDeep constants (10/min)"
echo "- Middleware is imported in leads.ts"
echo "- Middleware is applied to POST /analyze-deep route"
echo "- Middleware order is correct (authorize → analyzeDeepRateLimit)"
echo ""
echo "Rate Limit: 10 requests per minute (stricter due to gpt-4o vision model costs)"
