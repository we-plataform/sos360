# Scraping Error Handling Tests

This directory contains tests for error handling in the scraping API.

## Test Files

### 1. `scraping-error-handling.test.ts`
Comprehensive unit tests for error handling scenarios. Requires full test infrastructure.

**Test Coverage:**
- Invalid URL format validation (completely invalid, missing protocol, multiple invalid URLs)
- Invalid platform validation
- URL array validation (empty array, more than 100 URLs)
- Profile not found error handling
- Rate limiting (10 requests per minute, 429 on 11th request)
- Authentication required
- Authorization required (non-admin users)
- Job not found errors

### 2. `manual-error-handling-test.ts`
Integration tests that can be run against a running API server.

**Prerequisites:**
1. API server running at `http://localhost:3001`
2. Database connection available
3. Redis connection available (optional - graceful degradation if not available)

## Running Tests

### Manual Integration Tests

**Step 1:** Start the API server
```bash
npm run api:dev
```

**Step 2:** In a separate terminal, run the error handling tests
```bash
npm run test:scraping-errors
```

Or run directly with tsx:
```bash
tsx apps/api/src/tests/manual-error-handling-test.ts
```

### Custom API URL

To test against a different server:
```bash
API_URL=https://staging-api.example.com npm run test:scraping-errors
```

## Test Scenarios

### 1. Invalid URL Format
- ✅ Rejects completely invalid URLs (e.g., "not-a-url")
- ✅ Rejects URLs missing protocol (e.g., "linkedin.com/in/user")
- ✅ Rejects arrays containing any invalid URL
- ✅ Accepts valid LinkedIn URLs (e.g., "https://linkedin.com/in/username")

**Expected Behavior:**
- HTTP 400 status code
- Error message: "URL inválida: [url]"

### 2. Invalid Platform
- ✅ Rejects unsupported platforms
- ✅ Returns list of valid platforms: linkedin, instagram, facebook, twitter, x

**Expected Behavior:**
- HTTP 400 status code
- Error message: "Plataforma inválida. Plataformas suportadas: ..."

### 3. URL Array Validation
- ✅ Rejects empty URL arrays
- ✅ Rejects arrays with more than 100 URLs
- ✅ Accepts arrays with 1-100 URLs

**Expected Behavior:**
- HTTP 400 status code
- Zod validation error

### 4. Rate Limiting
- ✅ Allows up to 10 job submissions per minute per user
- ✅ Returns 429 status on 11th request
- ✅ Includes rate limit headers (X-RateLimit-Limit, etc.)

**Expected Behavior:**
- HTTP 429 status code
- Error type: "rate_limited"
- Retry-After header or rate limit reset timestamp

### 5. Authentication Required
- ✅ Rejects all scraping endpoints without valid JWT token
- ✅ Returns 401 status for unauthenticated requests

**Expected Behavior:**
- HTTP 401 status code
- Error message indicating authentication required

### 6. Authorization Required
- ✅ Rejects job submission from non-admin users (viewer, agent)
- ✅ Allows job submission from admin roles (owner, admin, manager)

**Expected Behavior:**
- HTTP 403 status code
- Error message indicating insufficient permissions

### 7. Profile Not Found
- ✅ Worker handles non-existent profiles gracefully
- ✅ Job status updates to "failed"
- ✅ Error details logged in job errors field

**Expected Behavior:**
- Job status: "failed"
- Error message: "Profile not found or failed to load"
- Individual URL errors recorded

### 8. Job Not Found
- ✅ Returns 404 for non-existent job IDs
- ✅ Includes descriptive error message

**Expected Behavior:**
- HTTP 404 status code
- Error message: "Scraping job not found"

## Error Handling Architecture

### Request Validation Layer
1. **Zod Schema Validation** (shared package)
   - URL format validation
   - Platform enum validation
   - Array length constraints

2. **Route-Level Validation** (scraping routes)
   - Platform support check
   - Additional business logic validation

### Rate Limiting Layer
1. **Express Rate Limit Middleware**
   - Per-user rate limiting (based on user ID)
   - Per-IP fallback for unauthenticated requests
   - Configurable limits (10 requests/minute for scraping)

2. **BullMQ Rate Limiter**
   - Worker-side rate limiting (3 jobs/second)
   - Prevents worker overload

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "error": {
    "type": "error_type",
    "title": "Error Title",
    "status": 400,
    "detail": "Detailed error message in Portuguese"
  }
}
```

## Monitoring and Debugging

### Check Rate Limit Status
Look for these headers in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### View Job Errors
Query the database for failed jobs:
```sql
SELECT id, status, errors, "completedAt"
FROM "ScrapingJob"
WHERE status = 'failed'
ORDER BY "createdAt" DESC;
```

### Check Worker Logs
Worker logs include:
- Job start/completion
- Individual URL processing
- Error details for failed URLs
- Progress updates

## Troubleshooting

### Rate Limit Issues
**Problem:** All requests return 429
**Solution:** Wait for the rate limit window to expire (60 seconds) or restart the server to clear in-memory rate limit state

### Authentication Failures
**Problem:** 401 errors despite providing token
**Solution:**
- Verify token is not expired
- Check JWT_SECRET in .env
- Ensure token format: `Bearer <token>`

### Worker Not Processing Jobs
**Problem:** Jobs stuck in "pending" status
**Solution:**
- Check Redis connection: `redis-cli ping`
- Verify worker is started in logs
- Check BullMQ queue: `redis-cli > KEYS bull:scraping-jobs*`

## Continuous Integration

These tests should be run:
1. Before deploying to staging
2. After any changes to scraping routes or validation logic
3. After modifying rate limiting configuration
4. As part of the QA sign-off process

## Future Enhancements

- [ ] Add automated unit tests with mocked dependencies
- [ ] Add integration tests with test database
- [ ] Add performance tests for rate limiting
- [ ] Add stress tests for concurrent job submissions
- [ ] Add tests for error recovery and retry logic
