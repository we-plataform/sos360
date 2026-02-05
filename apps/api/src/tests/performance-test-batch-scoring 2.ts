/**
 * Performance Test: Batch Scoring with 50+ Leads
 *
 * This script tests the performance of the batch scoring feature by:
 * 1. Creating 50+ test leads
 * 2. Scoring them using the batch scoring API
 * 3. Measuring time and performance metrics
 * 4. Generating a performance report
 *
 * Usage:
 *   npm run test:performance:scoring
 *
 * Or run directly:
 *   npx tsx apps/api/src/tests/performance-test-batch-scoring.ts
 */

import { prisma, Lead, CompanySize } from '@lia360/database';
import type { Prisma } from '@lia360/database';
import { calculateLeadScore, batchCalculateLeadScores } from '../services/scoring.js';

interface PerformanceMetrics {
    totalLeads: number;
    totalTimeMs: number;
    avgTimePerLeadMs: number;
    leadsPerSecond: number;
    successCount: number;
    errorCount: number;
    scores: {
        min: number;
        max: number;
        avg: number;
    };
    openAiApiCalls: number;
}

interface TestResult {
    success: boolean;
    metrics: PerformanceMetrics;
    errors: string[];
}

/**
 * Generate a random test lead
 */
function generateTestLead(index: number, workspaceId: string, pipelineStageId: string): Prisma.LeadCreateInput {
    const jobTitles = [
        'CEO', 'CTO', 'CFO', 'VP of Sales', 'Sales Director',
        'Marketing Manager', 'Product Manager', 'Engineering Manager',
        'Software Engineer', 'Data Analyst', 'Business Development Manager',
        'Account Executive', 'Sales Representative', 'Marketing Director'
    ];

    const companies = [
        'TechCorp Inc', 'DataDriven Co', 'CloudSystems Ltd',
        'AI Solutions Inc', 'DigitalTransform Co', 'GrowthLabs Ltd',
        'InnovateTech Inc', 'SmartBusiness Co', 'FutureSystems Ltd'
    ];

    const industries = [
        'Technology', 'Software', 'SaaS', 'FinTech', 'HealthTech',
        'EdTech', 'Marketing', 'Consulting', 'Manufacturing', 'Retail'
    ];

    const companySizes: CompanySize[] = [
        'SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_500',
        'SIZE_501_1000', 'SIZE_1001_5000', 'SIZE_5001_10000', 'SIZE_10001_PLUS'
    ];

    const randomJobTitle = jobTitles[Math.floor(Math.random() * jobTitles.length)];
    const randomCompany = companies[Math.floor(Math.random() * companies.length)];
    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
    const randomCompanySize = companySizes[Math.floor(Math.random() * companySizes.length)];

    // Varying profile completeness
    const hasCompleteProfile = Math.random() > 0.3; // 70% have complete profiles
    const hasEnrichment = Math.random() > 0.5; // 50% have enrichment

    return {
        workspace: {
            connect: { id: workspaceId },
        },
        pipelineStage: {
            connect: { id: pipelineStageId },
        },
        fullName: `Test Lead ${index + 1}`,
        username: `testlead${index + 1}`,
        email: `test.lead${index + 1}@example.com`,
        phone: hasCompleteProfile ? `+1-555-${String(Math.floor(Math.random() * 9000) + 1000)}` : null,
        location: hasCompleteProfile ? 'São Paulo, Brazil' : null,
        bio: hasCompleteProfile ? `Professional with expertise in ${randomIndustry.toLowerCase()}. Passionate about innovation and growth.` : null,
        company: randomCompany,
        companySize: randomCompanySize,
        industry: randomIndustry,
        jobTitle: randomJobTitle,
        headline: hasCompleteProfile ? `${randomJobTitle} at ${randomCompany}` : null,
        website: hasCompleteProfile ? `https://www.example.com/${index + 1}` : null,
        profileUrl: `https://linkedin.com/in/testlead${index + 1}`,
        platform: 'linkedin',
        followersCount: Math.floor(Math.random() * 50000),
        connectionCount: Math.floor(Math.random() * 1000),
        postsCount: Math.floor(Math.random() * 200),
        verified: Math.random() > 0.7,
        enrichmentStatus: hasEnrichment ? (Math.random() > 0.3 ? 'complete' : 'partial') : 'none',
        score: 0, // Initial score
    };
}

/**
 * Create test leads in the database
 */
async function createTestLeads(
    count: number,
    workspaceId: string,
    pipelineStageId: string
): Promise<Lead[]> {
    console.log(`\n📝 Creating ${count} test leads...`);

    const leads: Lead[] = [];

    for (let i = 0; i < count; i++) {
        const leadData = generateTestLead(i, workspaceId, pipelineStageId);
        const lead = await prisma.lead.create({
            data: leadData,
        });
        leads.push(lead);

        if ((i + 1) % 10 === 0) {
            console.log(`   Created ${i + 1}/${count} leads...`);
        }
    }

    console.log(`✅ Created ${leads.length} test leads`);
    return leads;
}

/**
 * Test single lead scoring performance
 */
async function testSingleScoring(leadId: string, workspaceId: string): Promise<number> {
    const start = Date.now();
    await calculateLeadScore(leadId, workspaceId);
    return Date.now() - start;
}

/**
 * Test batch scoring performance
 */
async function testBatchScoring(leadIds: string[], workspaceId: string): Promise<{
    timeMs: number;
    results: Array<{ leadId: string; breakdown: any; error?: string }>;
}> {
    const start = Date.now();
    const results = await batchCalculateLeadScores(leadIds, workspaceId);
    return {
        timeMs: Date.now() - start,
        results,
    };
}

/**
 * Calculate performance metrics
 */
function calculateMetrics(
    leadCount: number,
    totalTimeMs: number,
    results: Array<{ breakdown: any; error?: string }>
): PerformanceMetrics {
    const successResults = results.filter(r => !r.error);
    const scores = successResults.map(r => r.breakdown.finalScore);

    return {
        totalLeads: leadCount,
        totalTimeMs,
        avgTimePerLeadMs: totalTimeMs / leadCount,
        leadsPerSecond: (leadCount / (totalTimeMs / 1000)),
        successCount: successResults.length,
        errorCount: results.filter(r => r.error).length,
        scores: {
            min: Math.min(...scores),
            max: Math.max(...scores),
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        },
        openAiApiCalls: leadCount, // Each lead calls OpenAI once
    };
}

/**
 * Print performance report
 */
function printPerformanceReport(metrics: PerformanceMetrics, testType: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 PERFORMANCE REPORT: ${testType}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📈 Overall Metrics:`);
    console.log(`   Total Leads:              ${metrics.totalLeads}`);
    console.log(`   Total Time:               ${metrics.totalTimeMs.toLocaleString()}ms (${(metrics.totalTimeMs / 1000).toFixed(2)}s)`);
    console.log(`   Avg Time per Lead:        ${metrics.avgTimePerLeadMs.toFixed(2)}ms`);
    console.log(`   Throughput:               ${metrics.leadsPerSecond.toFixed(2)} leads/second`);
    console.log(`\n✅ Success Rate:`);
    console.log(`   Successful:               ${metrics.successCount} (${((metrics.successCount / metrics.totalLeads) * 100).toFixed(1)}%)`);
    console.log(`   Failed:                   ${metrics.errorCount} (${((metrics.errorCount / metrics.totalLeads) * 100).toFixed(1)}%)`);
    console.log(`\n🎯 Score Distribution:`);
    console.log(`   Min Score:                ${metrics.scores.min}`);
    console.log(`   Max Score:                ${metrics.scores.max}`);
    console.log(`   Avg Score:                ${metrics.scores.avg.toFixed(1)}`);
    console.log(`\n💰 OpenAI API Usage:`);
    console.log(`   Estimated API Calls:      ${metrics.openAiApiCalls}`);
    console.log(`   Estimated Cost (GPT-4o):  $${(metrics.openAiApiCalls * 0.000005).toFixed(4)} USD`);
    console.log(`   Estimated Cost (GPT-4o-mini): $${(metrics.openAiApiCalls * 0.00000015).toFixed(4)} USD`);
    console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main test execution
 */
async function runPerformanceTest(): Promise<TestResult> {
    const errors: string[] = [];

    try {
        console.log('\n🚀 Starting Batch Scoring Performance Test');
        console.log('='.repeat(60));

        // Get or create test workspace, pipeline, and stage
        console.log('\n🔧 Setting up test environment...');

        let workspace = await prisma.workspace.findFirst({
            where: { name: { contains: 'Test' } },
        });

        if (!workspace) {
            const company = await prisma.company.findFirst();
            if (!company) {
                throw new Error('No company found in database. Please create a company first.');
            }
            workspace = await prisma.workspace.create({
                data: {
                    name: 'Performance Test Workspace',
                    companyId: company.id,
                },
            });
            console.log(`✅ Created test workspace: ${workspace.name}`);
        } else {
            console.log(`✅ Using existing workspace: ${workspace.name}`);
        }

        let pipeline = await prisma.pipeline.findFirst({
            where: { workspaceId: workspace.id },
        });

        if (!pipeline) {
            pipeline = await prisma.pipeline.create({
                data: {
                    name: 'Performance Test Pipeline',
                    workspaceId: workspace.id,
                    stages: {
                        create: [
                            { name: 'New', order: 0 },
                            { name: 'Contacted', order: 1 },
                            { name: 'Qualified', order: 2 },
                        ],
                    },
                },
            });
            console.log(`✅ Created test pipeline: ${pipeline.name}`);
        } else {
            console.log(`✅ Using existing pipeline: ${pipeline.name}`);
        }

        const stages = await prisma.pipelineStage.findMany({
            where: { pipelineId: pipeline.id },
            orderBy: { order: 'asc' },
        });

        if (stages.length === 0) {
            throw new Error('No stages found in pipeline');
        }

        const pipelineStageId = stages[0].id;

        // Clean up existing test leads
        console.log('\n🧹 Cleaning up existing test leads...');
        await prisma.lead.deleteMany({
            where: {
                workspaceId: workspace.id,
                fullName: { startsWith: 'Test Lead' },
            },
        });
        console.log('✅ Cleanup complete');

        // Create test leads
        const LEAD_COUNT = 55; // More than 50 as required
        const leads = await createTestLeads(LEAD_COUNT, workspace.id, pipelineStageId);
        const leadIds = leads.map(l => l.id);

        // Test 1: Single lead scoring (sample of 5 leads)
        console.log('\n🧪 Test 1: Single Lead Scoring (5 leads sample)...');
        const sampleLeads = leadIds.slice(0, 5);
        let singleScoringTotal = 0;

        for (const leadId of sampleLeads) {
            const time = await testSingleScoring(leadId, workspace.id);
            singleScoringTotal += time;
        }

        const singleScoringMetrics = {
            totalLeads: sampleLeads.length,
            totalTimeMs: singleScoringTotal,
            avgTimePerLeadMs: singleScoringTotal / sampleLeads.length,
            leadsPerSecond: sampleLeads.length / (singleScoringTotal / 1000),
            successCount: sampleLeads.length,
            errorCount: 0,
            scores: { min: 0, max: 0, avg: 0 },
            openAiApiCalls: sampleLeads.length,
        };

        printPerformanceReport(singleScoringMetrics, 'Single Lead Scoring (Sample)');

        // Reset scores for batch test
        await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { score: 0 },
        });

        // Test 2: Batch scoring (all leads)
        console.log('\n🧪 Test 2: Batch Scoring (All leads)...');
        const batchResult = await testBatchScoring(leadIds, workspace.id);
        const batchMetrics = calculateMetrics(
            leadIds.length,
            batchResult.timeMs,
            batchResult.results
        );

        printPerformanceReport(batchMetrics, 'Batch Scoring (All Leads)');

        // Test 3: Batch scoring with different batch sizes
        console.log('\n🧪 Test 3: Batch Scoring Performance by Batch Size...');
        const batchSizes = [10, 25, 50];
        const batchPerformance: Array<{ size: number; timeMs: number; avgMs: number }> = [];

        for (const size of batchSizes) {
            const batchLeads = leadIds.slice(0, size);

            // Reset scores
            await prisma.lead.updateMany({
                where: { id: { in: batchLeads } },
                data: { score: 0 },
            });

            const start = Date.now();
            await batchCalculateLeadScores(batchLeads, workspace.id);
            const time = Date.now() - start;

            batchPerformance.push({
                size,
                timeMs: time,
                avgMs: time / size,
            });

            console.log(`   Batch size ${size}: ${time}ms total, ${(time / size).toFixed(2)}ms per lead`);
        }

        // Performance analysis
        console.log('\n📊 Performance Analysis:');
        console.log('   Batch Size | Total Time | Avg Time/Lead');
        console.log('   -----------|------------|---------------');
        for (const perf of batchPerformance) {
            console.log(`   ${String(perf.size).padEnd(10)} | ${String(perf.timeMs + 'ms').padEnd(10)} | ${perf.avgMs.toFixed(2)}ms`);
        }

        // Performance recommendations
        console.log('\n💡 Recommendations:');

        if (batchMetrics.leadsPerSecond < 1) {
            console.log('   ⚠️  WARNING: Scoring performance is below 1 lead/second');
            console.log('      Consider implementing:');
            console.log('      - Parallel processing for batch operations');
            console.log('      - Queue-based scoring for large batches');
            console.log('      - Caching for repeated scoring operations');
        } else if (batchMetrics.leadsPerSecond < 5) {
            console.log('   ⚠️  Scoring performance is moderate (1-5 leads/second)');
            console.log('      Consider optimizing for larger batches');
        } else {
            console.log('   ✅ Scoring performance is good (>5 leads/second)');
        }

        if (batchMetrics.errorCount > 0) {
            console.log(`   ⚠️  ${batchMetrics.errorCount} leads failed to score`);
            console.log('      Review error logs for details');
        }

        // Final summary
        console.log('\n✅ Performance test completed successfully!');
        console.log(`\n📝 Summary:`);
        console.log(`   - ${LEAD_COUNT} test leads created and scored`);
        console.log(`   - Batch scoring completed in ${(batchMetrics.totalTimeMs / 1000).toFixed(2)}s`);
        console.log(`   - Throughput: ${batchMetrics.leadsPerSecond.toFixed(2)} leads/second`);
        console.log(`   - Estimated OpenAI API cost: $${(batchMetrics.openAiApiCalls * 0.000005).toFixed(4)} USD (GPT-4o)`);

        return {
            success: true,
            metrics: batchMetrics,
            errors,
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(errorMsg);
        console.error('\n❌ Performance test failed:', errorMsg);

        return {
            success: false,
            metrics: {
                totalLeads: 0,
                totalTimeMs: 0,
                avgTimePerLeadMs: 0,
                leadsPerSecond: 0,
                successCount: 0,
                errorCount: 0,
                scores: { min: 0, max: 0, avg: 0 },
                openAiApiCalls: 0,
            },
            errors,
        };
    }
}

// Run the test
runPerformanceTest()
    .then((result) => {
        if (result.success) {
            console.log('\n✅ All tests passed!');
            process.exit(0);
        } else {
            console.log('\n❌ Tests failed!');
            console.log('Errors:', result.errors);
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('\n❌ Unexpected error:', error);
        process.exit(1);
    });
