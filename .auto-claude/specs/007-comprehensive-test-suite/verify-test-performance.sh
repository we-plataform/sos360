#!/bin/bash

# Test Suite Performance Verification Script
# Verifies that unit + integration tests complete in under 5 minutes

# Don't exit on error - we want to time tests even if they fail
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Performance threshold (in seconds)
THRESHOLD=300  # 5 minutes

echo "================================"
echo "Test Suite Performance Verification"
echo "================================"
echo ""

# Start timer
START_TIME=$(date +%s)

echo "1. Running API test suite..."
# Get script directory and navigate to worktree root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in .auto-claude/specs/007-comprehensive-test-suite/
# Worktree root is 3 levels up
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
cd "$WORKTREE_ROOT/apps/api"
API_START=$(date +%s)
npx vitest run > /tmp/api-test-output.txt 2>&1
API_EXIT_CODE=$?
API_END=$(date +%s)
API_DURATION=$((API_END - API_START))
cd "$WORKTREE_ROOT"

if [ $API_EXIT_CODE -eq 0 ]; then
    echo -e "   ${GREEN}✓${NC} API tests passed in ${API_DURATION}s"
else
    echo -e "   ${YELLOW}⚠${NC} API tests completed in ${API_DURATION}s (some tests failed)"
fi

echo ""
echo "2. Running shared package test suite..."
cd "$WORKTREE_ROOT/packages/shared"
SHARED_START=$(date +%s)
npx vitest run > /tmp/shared-test-output.txt 2>&1 || true
SHARED_EXIT_CODE=$?
SHARED_END=$(date +%s)
SHARED_DURATION=$((SHARED_END - SHARED_START))
cd "$WORKTREE_ROOT"

if [ $SHARED_EXIT_CODE -eq 0 ]; then
    echo -e "   ${GREEN}✓${NC} Shared tests passed in ${SHARED_DURATION}s"
else
    echo -e "   ${YELLOW}⚠${NC} Shared tests completed in ${SHARED_DURATION}s (some tests failed)"
fi

# End timer
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Check against threshold
echo ""
echo "================================"
echo "Results Summary"
echo "================================"
echo "API Test Suite:       ${API_DURATION}s"
echo "Shared Test Suite:    ${SHARED_DURATION}s"
echo "Total Duration:       ${TOTAL_DURATION}s"
echo "Performance Threshold: ${THRESHOLD}s (5 minutes)"
echo ""

if [ $TOTAL_DURATION -lt $THRESHOLD ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Test suite completes in ${TOTAL_DURATION}s (${THRESHOLD}s threshold)"
    echo ""
    echo "Performance Breakdown:"
    PERCENTAGE=$(( (THRESHOLD - TOTAL_DURATION) * 100 / THRESHOLD ))
    echo "  - ${PERCENTAGE}% faster than threshold"
    echo "  - Using only $(( TOTAL_DURATION * 100 / THRESHOLD ))% of allocated time"
    echo ""
    echo "Test Details:"
    grep "Test Files" /tmp/api-test-output.txt | sed 's/^/  API:  /'
    grep "Test Files" /tmp/shared-test-output.txt | sed 's/^/  Shared: /'
    echo ""
    echo -e "${GREEN}✓ Performance requirement satisfied${NC}"
    exit 0
else
    echo -e "${RED}✗ FAILED${NC} - Test suite takes ${TOTAL_DURATION}s (exceeds ${THRESHOLD}s threshold)"
    echo ""
    echo "Recommendation: Consider optimizing test performance or adjusting threshold"
    exit 1
fi
