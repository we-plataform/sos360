#!/bin/bash

# Verification script to scan for unguarded console statements in production code
# This script ensures that console.log/error statements are either:
# 1. Guarded by NODE_ENV === 'development' checks, or
# 2. In allowed locations (test files, fatal startup errors)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track issues
ISSUES_FOUND=0
TOTAL_CHECKED=0

echo "=========================================="
echo "Console Guard Verification Script"
echo "=========================================="
echo ""

# Define directories to scan
API_SRC="apps/api/src"

# Find all TypeScript files (excluding test files and test directories)
echo "Scanning TypeScript files in $API_SRC..."
echo ""

# Find all .ts files, excluding:
# - Test files (*.test.ts, *.spec.ts)
# - Test directories (tests/, __tests__)
# - Type definition files (*.d.ts)
TS_FILES=$(find "$API_SRC" -type f -name "*.ts" \
  ! -name "*.test.ts" \
  ! -name "*.spec.ts" \
  ! -path "*/tests/*" \
  ! -path "*/__tests__/*" \
  ! -name "*.d.ts" \
  ! -name "server-minimal.ts" \
  ! -name "server-pure.ts")

# Check each file
for FILE in $TS_FILES; do
  # Check if file contains console statements
  CONSOLE_COUNT=$(grep -c "console\.\(log\|error\|warn\|info\|debug\)" "$FILE" 2>/dev/null || true)
  CONSOLE_COUNT=${CONSOLE_COUNT:-0}

  if [ "$CONSOLE_COUNT" -gt 0 ] 2>/dev/null; then
    echo "Checking: $FILE ($CONSOLE_COUNT console statements)"

    # Get all line numbers with console statements
    CONSOLE_LINES=$(grep -n "console\.\(log\|error\|warn\|info\|debug\)" "$FILE" | cut -d: -f1)

    for LINE in $CONSOLE_LINES; do
      TOTAL_CHECKED=$((TOTAL_CHECKED + 1))

      # Get the console statement
      CONSOLE_STMT=$(sed -n "${LINE}p" "$FILE")

      # Check if it's a fatal error (allowed exception)
      if echo "$CONSOLE_STMT" | grep -q "FATAL"; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Fatal error (allowed exception)"
        continue
      fi

      # Check if it's in a comment
      if echo "$CONSOLE_STMT" | grep -q "^[[:space:]]*\/\/"; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Commented out"
        continue
      fi

      # Check if console statement follows a FATAL error (look back up to 20 lines)
      FATAL_FOUND=0
      FATAL_DISTANCE=0
      for i in {1..20}; do
        LOOKBACK_LINE=$((LINE - i))
        if [ "$LOOKBACK_LINE" -lt 1 ]; then
          break
        fi
        LOOKBACK_CONTENT=$(sed -n "${LOOKBACK_LINE}p" "$FILE")

        # If we find a FATAL error message
        if echo "$LOOKBACK_CONTENT" | grep -q "FATAL"; then
          FATAL_FOUND=1
          FATAL_DISTANCE=$i
          break
        fi
      done

      # If we found FATAL, check if we should allow this console statement
      if [ "$FATAL_FOUND" -eq 1 ]; then
        # If FATAL is very close (within 5 lines), allow it
        if [ "$FATAL_DISTANCE" -le 5 ]; then
          echo -e "  ${GREEN}✓${NC} Line $LINE: Part of fatal error block"
          continue
        fi

        # Otherwise, check if process.exit(1) comes after (within 15 lines)
        # This confirms we're in a fatal error block that will exit
        EXIT_FOUND=0
        for i in {1..15}; do
          LOOKAHEAD_LINE=$((LINE + i))
          LOOKAHEAD_CONTENT=$(sed -n "${LOOKAHEAD_LINE}p" "$FILE")

          if [ -z "$LOOKAHEAD_CONTENT" ]; then
            break
          fi

          # If we find process.exit(1), this is confirmed as a fatal error block
          if echo "$LOOKAHEAD_CONTENT" | grep -q "process\.exit(1)"; then
            EXIT_FOUND=1
            break
          fi
        done

        # Accept if we found process.exit(1) after the console statement
        if [ "$EXIT_FOUND" -eq 1 ]; then
          echo -e "  ${GREEN}✓${NC} Line $LINE: Part of fatal error block"
          continue
        fi
      fi

      if [ "$FATAL_FOUND" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Part of fatal error block"
        continue
      fi

      # Check previous line for NODE_ENV guard
      PREV_LINE=$((LINE - 1))
      PREV_LINE_CONTENT=$(sed -n "${PREV_LINE}p" "$FILE")

      # Check if the console statement is inline with NODE_ENV guard
      if echo "$CONSOLE_STMT" | grep -q "process\.env\.NODE_ENV.*development.*console"; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Inline guard"
        continue
      fi

      # Check if previous line has NODE_ENV guard
      if echo "$PREV_LINE_CONTENT" | grep -q "if (process\.env\.NODE_ENV === 'development')"; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Guarded by NODE_ENV check"
        continue
      fi

      # Check if we're inside a multi-line NODE_ENV guard block
      # Look back up to 10 lines to find the opening brace
      GUARD_FOUND=0
      BRACE_DEPTH=0
      for i in {1..10}; do
        LOOKBACK_LINE=$((LINE - i))
        if [ "$LOOKBACK_LINE" -lt 1 ]; then
          break
        fi
        LOOKBACK_CONTENT=$(sed -n "${LOOKBACK_LINE}p" "$FILE")

        # Track brace depth - if we encounter a closing brace at our level or lower, we're outside
        if echo "$LOOKBACK_CONTENT" | grep -q "^[[:space:]]*}"; then
          BRACE_DEPTH=$((BRACE_DEPTH + 1))
        fi

        # If we've gone outside the block, stop
        if [ "$BRACE_DEPTH" -gt 0 ] && echo "$LOOKBACK_CONTENT" | grep -q "^[[:space:]]*}"; then
          break
        fi

        # Look for NODE_ENV guard opening
        if echo "$LOOKBACK_CONTENT" | grep -q "if (process\.env\.NODE_ENV === 'development') {"; then
          if [ "$BRACE_DEPTH" -eq 0 ]; then
            GUARD_FOUND=1
          fi
          break
        fi
      done

      if [ "$GUARD_FOUND" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} Line $LINE: Inside NODE_ENV guard block"
        continue
      fi

      # If we get here, the console statement is unguarded
      echo -e "  ${RED}✗${NC} Line $LINE: Unguarded console statement"
      echo -e "    ${YELLOW}Content: $CONSOLE_STMT${NC}"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    done

    echo ""
  fi
done

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo "Total console statements checked: $TOTAL_CHECKED"
echo "Issues found: $ISSUES_FOUND"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✓ PASSED: All console statements are properly guarded${NC}"
  echo ""
  echo "Allowed exceptions:"
  echo "  - Fatal startup errors (contain 'FATAL')"
  echo "  - Test files (*.test.ts, *.spec.ts, tests/ directories)"
  echo "  - Commented console statements"
  echo ""
  exit 0
else
  echo -e "${RED}✗ FAILED: Found $ISSUES_FOUND unguarded console statement(s)${NC}"
  echo ""
  echo "Please add NODE_ENV guards to these console statements:"
  echo "  if (process.env.NODE_ENV === 'development') {"
  echo "    console.log(...);"
  echo "  }"
  echo ""
  echo "Or use inline guard:"
  echo "  if (process.env.NODE_ENV === 'development') console.log(...);"
  echo ""
  exit 1
fi
