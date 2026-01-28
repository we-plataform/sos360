#!/bin/bash

# Test script to verify JWT access token expiration time
# This script tests login and verifies the access token expires in 15 minutes

set -e

API_URL="http://localhost:3001"
LOGIN_ENDPOINT="/api/v1/auth/login"

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local color=$2
    local message=$1
    echo -e "${color}${message}${NC}"
}

log "\n========================================" "${BLUE}"
log "  JWT Token Expiration Test" "${BLUE}"
log "========================================" "${BLUE}"

# Test credentials
TEST_EMAIL="test@example.com"
TEST_PASSWORD="password123"

log "\n=== Testing Login Endpoint ===" "${BLUE}"
log "Email: ${TEST_EMAIL}" "${BLUE}"

# Try login
LOGIN_RESPONSE=$(curl -s -X POST \
  "${API_URL}${LOGIN_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

log "\nLogin response:" "${YELLOW}"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"

# Check if login was successful
SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$SUCCESS" != "true" ]; then
    log "\n❌ Login failed" "${RED}"
    log "\nHint: Make sure you have a test user in the database" "${YELLOW}"
    log "You can create one using:" "${YELLOW}"
    log "curl -X POST ${API_URL}/api/v1/auth/register \\"
    log "  -H 'Content-Type: application/json' \\"
    log "  -d '{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"fullName\":\"Test User\",\"companyName\":\"Test Company\"}'" "${YELLOW}"
    exit 1
fi

log "\n✅ Login successful!" "${GREEN}"

# Check if context selection is required
SELECTION_REQUIRED=$(echo "$LOGIN_RESPONSE" | jq -r '.data.selectionRequired' 2>/dev/null || echo "false")

if [ "$SELECTION_REQUIRED" == "true" ]; then
    log "\n⚠️  Context selection required" "${YELLOW}"

    # Select first context
    SELECTION_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.selectionToken')

    COMPANY_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.companies[0].id')
    WORKSPACE_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.companies[0].workspaces[0].id')

    log "\nSelecting context..." "${YELLOW}"

    SELECT_RESPONSE=$(curl -s -X POST \
      "${API_URL}/api/v1/auth/select-context" \
      -H "Content-Type: application/json" \
      -d "{\"selectionToken\":\"${SELECTION_TOKEN}\",\"companyId\":\"${COMPANY_ID}\",\"workspaceId\":\"${WORKSPACE_ID}\"}")

    ACCESS_TOKEN=$(echo "$SELECT_RESPONSE" | jq -r '.data.accessToken')
    EXPIRES_IN=$(echo "$SELECT_RESPONSE" | jq -r '.data.expiresIn')
else
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
    EXPIRES_IN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.expiresIn')
fi

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    log "\n❌ Failed to obtain access token" "${RED}"
    exit 1
fi

log "\n=== Response Data ===" "${BLUE}"
log "ExpiresIn field: ${EXPIRES_IN} seconds" "${BLUE}"
log "Expected: 900 seconds (15 minutes)" "${BLUE}"

# Decode JWT token (base64)
TOKEN_PARTS=$(echo "$ACCESS_TOKEN" | tr '.' '\n')
PAYLOAD=$(echo "$TOKEN_PARTS" | sed -n '2p')

# Add padding if needed
PADDING=$((4 - ${#PAYLOAD} % 4))
if [ $PADDING -ne 4 ]; then
    PAYLOAD="${PAYLOAD}$(printf '=%.0s' $(seq 1 $PADDING))"
fi

DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "$PAYLOAD" | base64 -D 2>/dev/null)

if [ -z "$DECODED" ]; then
    log "\n❌ Failed to decode token" "${RED}"
    exit 1
fi

log "\n=== Decoded Token Payload ===" "${BLUE}"
echo "$DECODED" | jq . 2>/dev/null || echo "$DECODED"

# Extract expiration times
IAT=$(echo "$DECODED" | jq -r '.iat')
EXP=$(echo "$DECODED" | jq -r '.exp')
NOW=$(date +%s)

TOKEN_EXPIRES_IN=$((EXP - IAT))
TIME_UNTIL_EXPIRY=$((EXP - NOW))
TOKEN_EXPIRES_IN_MINUTES=$((TOKEN_EXPIRES_IN / 60))

log "\n=== Token Expiration Details ===" "${BLUE}"
log "Issued At (iat): $(date -r ${IAT} -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date -d @${IAT} -u '+%Y-%m-%d %H:%M:%S UTC')" "${BLUE}"
log "Expiration (exp): $(date -r ${EXP} -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date -d @${EXP} -u '+%Y-%m-%d %H:%M:%S UTC')" "${BLUE}"
log "Expires In (from iat to exp): ${TOKEN_EXPIRES_IN} seconds (${TOKEN_EXPIRES_IN_MINUTES} minutes)" "${BLUE}"
log "Time Until Expiry: ${TIME_UNTIL_EXPIRY} seconds ($((TIME_UNTIL_EXPIRY / 60)) minutes)" "${BLUE}"

# Verify results
log "\n=== Verification Results ===" "${BLUE}"

EXPECTED_EXPIRES_IN=900
TOLERANCE=5
ALL_PASSED=true

# Check expiresIn field
if [ "$EXPIRES_IN" == "$EXPECTED_EXPIRES_IN" ]; then
    log "✅ expiresIn field: ${EXPIRES_IN}s (correct!)" "${GREEN}"
else
    log "❌ expiresIn field: ${EXPIRES_IN}s (expected ${EXPECTED_EXPIRES_IN}s)" "${RED}"
    ALL_PASSED=false
fi

# Check token expiration (exp - iat)
DIFF=$((TOKEN_EXPIRES_IN - EXPECTED_EXPIRES_IN))
if [ ${DIFF#-} -le $TOLERANCE ]; then
    log "✅ Token expiration: ${TOKEN_EXPIRES_IN}s (correct!)" "${GREEN}"
else
    log "❌ Token expiration: ${TOKEN_EXPIRES_IN}s (expected ${EXPECTED_EXPIRES_IN}s)" "${RED}"
    ALL_PASSED=false
fi

# Check that token is still valid
if [ $EXP -gt $NOW ]; then
    log "✅ Token is still valid (${TIME_UNTIL_EXPIRY}s remaining)" "${GREEN}"
else
    log "❌ Token is expired" "${RED}"
    ALL_PASSED=false
fi

# Check that expiration is approximately 15 minutes from issuance
if [ $TOKEN_EXPIRES_IN_MINUTES -eq 15 ]; then
    log "✅ Token lifetime: ${TOKEN_EXPIRES_IN_MINUTES} minutes (correct!)" "${GREEN}"
else
    log "❌ Token lifetime: ${TOKEN_EXPIRES_IN_MINUTES} minutes (expected 15 minutes)" "${RED}"
    ALL_PASSED=false
fi

log "\n========================================" "${BLUE}"
if [ "$ALL_PASSED" = true ]; then
    log "✅ ALL CHECKS PASSED!" "${GREEN}"
    log "\nThe access token correctly expires in 15 minutes." "${GREEN}"
    log "\nSummary:" "${GREEN}"
    log "  • expiresIn field: ${EXPIRES_IN}s (15 minutes)" "${GREEN}"
    log "  • Token lifetime: ${TOKEN_EXPIRES_IN}s (${TOKEN_EXPIRES_IN_MINUTES} minutes)" "${GREEN}"
    log "  • Token expires at: $(date -r ${EXP} -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date -d @${EXP} -u '+%Y-%m-%d %H:%M:%S UTC')" "${GREEN}"
else
    log "❌ SOME CHECKS FAILED" "${RED}"
    log "\nPlease review the results above." "${RED}"
    exit 1
fi
log "========================================\n" "${BLUE}"
