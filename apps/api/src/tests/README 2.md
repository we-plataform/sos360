# Performance Tests

This directory contains performance and integration tests for the Lia360 API.

## Batch Scoring Performance Test

### Overview

The `performance-test-batch-scoring.ts` script tests the performance of the AI-powered lead scoring feature by:

1. Creating 55 test leads (exceeds the 50+ requirement)
2. Scoring them using the batch scoring service
3. Measuring time and performance metrics
4. Generating a detailed performance report

### Prerequisites

- Database connection (PostgreSQL)
- Valid `OPENAI_API_KEY` environment variable (optional, test will work with fallback)
- Node.js >= 20.0.0

### Running the Test

From the root directory, run:

```bash
npm run test:performance:scoring
```

Or run directly with tsx:

```bash
npx tsx apps/api/src/tests/performance-test-batch-scoring.ts
```

### What the Test Does

1. **Setup**: Creates or uses a test workspace with pipeline and stages
2. **Cleanup**: Removes any existing test leads
3. **Lead Creation**: Creates 55 diverse test leads with varying:
   - Job titles (CEO, Sales Manager, Engineer, etc.)
   - Company sizes (1-10 to 10000+ employees)
   - Industries (Technology, SaaS, FinTech, etc.)
   - Profile completeness (30% incomplete, 70% complete)
   - Enrichment status (50% enriched, 50% not)
   - Social metrics (followers, connections, posts)

4. **Single Lead Scoring Test**: Scores a sample of 5 leads individually
5. **Batch Scoring Test**: Scores all 55 leads in a single batch
6. **Batch Size Comparison**: Tests different batch sizes (10, 25, 50)

### Performance Metrics

The test reports:

- **Total Time**: Time to score all leads
- **Average Time per Lead**: Individual lead scoring performance
- **Throughput**: Leads scored per second
- **Success Rate**: Percentage of successfully scored leads
- **Score Distribution**: Min, max, and average scores
- **OpenAI API Usage**: Estimated API calls and cost

### Expected Results

**Good Performance**:
- Throughput: >5 leads/second
- Average time per lead: <200ms
- Success rate: 100%

**Acceptable Performance**:
- Throughput: 1-5 leads/second
- Average time per lead: 200ms-1s
- Success rate: >95%

**Needs Optimization**:
- Throughput: <1 lead/second
- Average time per lead: >1s
- Success rate: <95%

### Cost Estimation

The test estimates OpenAI API costs:

- **GPT-4o**: ~$0.000005 per lead = $0.000275 for 55 leads
- **GPT-4o-mini**: ~$0.00000015 per lead = $0.00000825 for 55 leads

**Note**: Actual costs vary based on prompt complexity and token usage.

### Sample Output

```
🚀 Starting Batch Scoring Performance Test
============================================================

🔧 Setting up test environment...
✅ Using existing workspace: Test Workspace
✅ Using existing pipeline: Sales Pipeline

🧹 Cleaning up existing test leads...
✅ Cleanup complete

📝 Creating 55 test leads...
   Created 10/55 leads...
   Created 20/55 leads...
   ...
✅ Created 55 test leads

🧪 Test 1: Single Lead Scoring (5 leads sample)...
============================================================
📊 PERFORMANCE REPORT: Single Lead Scoring (Sample)
============================================================

📈 Overall Metrics:
   Total Leads:              5
   Total Time:               1,234ms (1.23s)
   Avg Time per Lead:        246.80ms
   Throughput:               4.05 leads/second

✅ Success Rate:
   Successful:               5 (100.0%)
   Failed:                   0 (0.0%)

🎯 Score Distribution:
   Min Score:                42
   Max Score:                87
   Avg Score:                64.5

💰 OpenAI API Usage:
   Estimated API Calls:      5
   Estimated Cost (GPT-4o):  $0.0000250 USD
   Estimated Cost (GPT-4o-mini): $0.00000075 USD
============================================================

🧪 Test 2: Batch Scoring (All leads)...
============================================================
📊 PERFORMANCE REPORT: Batch Scoring (All Leads)
============================================================

📈 Overall Metrics:
   Total Leads:              55
   Total Time:               8,432ms (8.43s)
   Avg Time per Lead:        153.31ms
   Throughput:               6.52 leads/second

✅ Success Rate:
   Successful:               55 (100.0%)
   Failed:                   0 (0.0%)

🎯 Score Distribution:
   Min Score:                28
   Max Score:                92
   Avg Score:                61.3

💰 OpenAI API Usage:
   Estimated API Calls:      55
   Estimated Cost (GPT-4o):  $0.0002750 USD
   Estimated Cost (GPT-4o-mini): $0.00000825 USD
============================================================

✅ Performance test completed successfully!

📝 Summary:
   - 55 test leads created and scored
   - Batch scoring completed in 8.43s
   - Throughput: 6.52 leads/second
   - Estimated OpenAI API cost: $0.0003 USD (GPT-4o)

💡 Recommendations:
   ✅ Scoring performance is good (>5 leads/second)
```

### Cleanup

The test automatically cleans up test leads before running. To manually clean up:

```sql
DELETE FROM "Lead" WHERE "fullName" LIKE 'Test Lead%';
```

Or via Prisma Studio:

```bash
npm run db:studio
```

### Troubleshooting

**Error: "No company found in database"**

Create a test company first via the API or Prisma Studio.

**Error: "OPENAI_API_KEY not set"**

The scoring feature will work with fallback explanations, but for full functionality:

1. Create an OpenAI account at https://platform.openai.com
2. Generate an API key
3. Add to `.env` file: `OPENAI_API_KEY=sk-...`

**Performance is slow (<1 lead/second)**

Possible causes:
- Database connection issues
- High latency to OpenAI API
- Network issues
- Insufficient resources

Check logs for specific error messages.

### Integration with CI/CD

To add this test to CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  performance:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        run: npm run db:push

      - name: Run performance test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lia360
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npm run test:performance:scoring
```

### Performance Optimization Recommendations

If performance is below expectations:

1. **Parallel Processing**: Implement Promise.all() for batch operations
2. **Queue System**: Use a job queue (Bull, Agenda) for large batches
3. **Caching**: Cache scoring results for unchanged leads
4. **Batch API Calls**: Batch OpenAI API calls if possible
5. **Database Indexing**: Ensure proper indexes on lead fields
6. **Connection Pooling**: Optimize database connection pool size

### Related Files

- `apps/api/src/services/scoring.ts` - Scoring service implementation
- `apps/api/src/routes/scoring.ts` - Scoring API endpoints
- `packages/database/prisma/schema.prisma` - Database schema
- `packages/shared/src/schemas/scoring.ts` - Validation schemas

---

## Cloud Browser Scraping E2E Test

### Overview

The `manual-e2e-scraping-test.ts` script tests the complete browser automation scraping workflow by:

1. Submitting scraping jobs to the API
2. Monitoring job status progression (pending → processing → completed)
3. Retrieving and validating scraped results
4. Verifying database persistence
5. Testing error handling scenarios

### Prerequisites

- API server running on http://localhost:3001 (`npm run api:dev`)
- Redis running (for BullMQ queue)
- Valid authentication token (JWT)
- Valid workspace ID
- Puppeteer installed (for browser automation)

### Running the Test

```bash
# Set required environment variables
export API_URL="http://localhost:3001"
export TEST_WORKSPACE_ID="your-workspace-id"
export TEST_AUTH_TOKEN="your-jwt-token"

# Run the test
npx tsx apps/api/src/tests/manual-e2e-scraping-test.ts
```

### Test Coverage

1. **Create Scraping Job**: Submit job with LinkedIn URLs
2. **Check Status Pending**: Verify job starts in "pending" status
3. **Wait for Completion**: Monitor status progression to "completed"
4. **Retrieve Results**: Validate scraped data structure
5. **Database Persistence**: Verify all fields stored in database
6. **List Jobs**: Test pagination and filtering
7. **Error Handling**: Invalid URL validation
8. **Error Handling**: Invalid platform validation

### What Gets Tested

#### Job Submission
```bash
POST /api/v1/scraping/jobs
{
  "urls": ["https://www.linkedin.com/in/williamhgates"],
  "platform": "linkedin"
}
```
- ✅ Returns 201 with job ID
- ✅ Job status is "pending"
- ✅ Invalid URLs rejected (400)
- ✅ Invalid platforms rejected (400)

#### Job Status Progression
```bash
GET /api/v1/scraping/jobs/:id
```
- ✅ Status: pending → processing → completed
- ✅ Progress updates (0/1 → 1/1)
- ✅ Timestamps: createdAt, startedAt, completedAt
- ✅ Non-existent job returns 404

#### Results Retrieval
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "results": [
      {
        "url": "https://www.linkedin.com/in/...",
        "success": true,
        "data": {
          "fullName": "Bill Gates",
          "headline": "Co-chair...",
          "company": "Bill & Melinda Gates Foundation",
          "location": "Seattle, Washington",
          "industry": "Philanthropic Fundraising"
        }
      }
    ],
    "errors": {}
  }
}
```

#### Database Verification
- ✅ ScrapingJob record created
- ✅ All fields populated correctly
- ✅ Results stored as JSON
- ✅ Errors logged for failed URLs

### Expected Results

**Successful Test Output**:
```
✅ PASS - Create Job
✅ PASS - Check Status Pending
✅ PASS - Wait for Completion
✅ PASS - Retrieve Results
✅ PASS - Database Persistence
✅ PASS - List Jobs
✅ PASS - Invalid URL Handling
✅ PASS - Invalid Platform Handling

Total: 8/8 tests passed
```

### Troubleshooting

**Job stuck in "pending" status**
- Check API logs for "Scraping worker started"
- Verify Redis is running: `redis-cli ping`
- Check BROWSER_POOL_MAX_SIZE env var

**Scraper fails with "Profile not found"**
- LinkedIn profile may not exist or be private
- Test with a public profile URL
- Check browser stealth configuration

**Authentication errors**
- Verify JWT token is valid and not expired
- Check user has workspace admin role
- Test token with: `curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/leads`

**Redis connection errors**
- Start Redis: `npm run docker:up` or `redis-server`
- Check REDIS_URL in .env
- Verify Redis port 6379 is accessible

### Clean Up Test Data

```sql
-- Delete test scraping jobs
DELETE FROM "ScrapingJob" WHERE metadata->>'source' = 'e2e-test';

-- Or delete by workspace
DELETE FROM "ScrapingJob" WHERE "workspaceId" = 'test-workspace-123';
```

### Related Files

- `apps/api/src/routes/scraping.ts` - Scraping API endpoints
- `apps/api/src/jobs/scraping.worker.ts` - BullMQ worker
- `apps/api/src/lib/scrapers/linkedin.ts` - LinkedIn scraper
- `apps/api/src/lib/browser-pool.ts` - Browser pool manager
- `packages/database/prisma/schema.prisma` - ScrapingJob model
