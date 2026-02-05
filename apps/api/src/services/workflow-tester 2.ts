import { prisma } from '@lia360/database';
import { logger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { executeWorkflow, validateWorkflowForExecution, type LeadContext } from './workflow-executor.js';

/**
 * Test run result interface
 */
export interface TestRunResult {
  success: boolean;
  testRunId: string;
  workflowId: string;
  testLeadId: string | null;
  executionTrace: {
    nodesVisited: string[];
    nodesCompleted: string[];
    nodesSkipped: string[];
    actionsTaken: Array<{ nodeId: string; action: string; result: unknown }>;
    errors: Array<{ nodeId: string; error: string }>;
  };
  duration: number;
  error?: string;
}

/**
 * Run a workflow test in dry-run mode
 * @param testRunId - Test run ID to update
 * @returns Test run result with execution trace
 */
export async function runWorkflowTest(testRunId: string): Promise<TestRunResult> {
  const startTime = Date.now();

  try {
    // Fetch test run
    const testRun = await prisma.workflowTestRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new NotFoundError('WorkflowTestRun');
    }

    // Update test run status to running
    await prisma.workflowTestRun.update({
      where: { id: testRunId },
      data: { status: 'running' },
    });

    // Fetch workflow with nodes and edges
    const workflow = await prisma.workflow.findUnique({
      where: { id: testRun.workflowId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    // Validate workflow before testing
    await validateWorkflowForExecution(workflow.id);

    // Get or create test lead context
    let leadContext: LeadContext;

    if (testRun.testLeadId) {
      // Fetch the actual test lead with tags
      const lead = await prisma.lead.findUnique({
        where: { id: testRun.testLeadId },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!lead) {
        throw new NotFoundError('Lead');
      }

      leadContext = {
        id: lead.id,
        workspaceId: lead.workspaceId,
        data: {
          fullName: lead.fullName,
          username: lead.username,
          email: lead.email,
          profileUrl: lead.profileUrl,
          platform: lead.platform,
          avatarUrl: lead.avatarUrl,
          bio: lead.bio,
          headline: lead.headline,
          company: lead.company,
          industry: lead.industry,
          location: lead.location,
          score: lead.score,
          tags: lead.tags.map((lt) => lt.tag.name),
          pipelineStageId: lead.pipelineStageId,
        },
      };
    } else {
      // Create mock test lead
      leadContext = {
        id: 'mock-test-lead-id',
        workspaceId: workflow.workspaceId,
        data: {
          fullName: 'Test Lead',
          username: 'testlead',
          email: 'test@example.com',
          profileUrl: 'https://example.com/testlead',
          platform: 'linkedin',
          avatarUrl: null,
          bio: 'Test lead for workflow testing',
          headline: 'Test User',
          company: 'Test Company',
          industry: 'Technology',
          location: 'San Francisco, CA',
          score: 50,
          tags: [],
          pipelineStageId: null,
        },
      };
    }

    // Execute workflow in dry-run mode
    const executionResult = await executeWorkflow(
      workflow.id,
      leadContext,
      true // isDryRun = true
    );

    const duration = Date.now() - startTime;

    // Build execution trace
    const executionTrace = {
      nodesVisited: executionResult.state.visitedNodes,
      nodesCompleted: executionResult.state.completedNodes,
      nodesSkipped: executionResult.state.skippedNodes,
      actionsTaken: executionResult.actionsTaken,
      errors: executionResult.state.errors,
    };

    // Convert result to JSON-serializable format for Prisma
    const resultData = {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
      },
      testLeadId: testRun.testLeadId,
      executionTrace,
      duration,
      isDryRun: true,
      metadata: executionResult.state.metadata,
    };
    const jsonValue = JSON.parse(JSON.stringify(resultData));

    // Update test run with results
    const finalStatus = executionResult.success ? 'completed' : 'failed';
    await prisma.workflowTestRun.update({
      where: { id: testRunId },
      data: {
        status: finalStatus,
        result: jsonValue,
        completedAt: new Date(),
      },
    });

    logger.info({
      testRunId,
      workflowId: workflow.id,
      status: finalStatus,
      duration,
      nodesVisited: executionTrace.nodesVisited.length,
      actionsTaken: executionTrace.actionsTaken.length,
      errors: executionTrace.errors.length,
    }, 'Workflow test run completed');

    return {
      success: executionResult.success,
      testRunId,
      workflowId: workflow.id,
      testLeadId: testRun.testLeadId,
      executionTrace,
      duration,
      error: executionResult.error,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update test run with error status
    try {
      await prisma.workflowTestRun.update({
        where: { id: testRunId },
        data: {
          status: 'failed',
          result: {
            error: errorMessage,
            duration,
          },
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      logger.error({
        testRunId,
        error: updateError instanceof Error ? updateError.message : 'Unknown error',
      }, 'Failed to update test run with error status');
    }

    logger.error({
      testRunId,
      error: errorMessage,
      duration,
    }, 'Workflow test run failed');

    throw error;
  }
}

/**
 * Create a new workflow test run and execute it
 * @param workflowId - Workflow ID to test
 * @param testLeadId - Optional test lead ID
 * @returns Test run result with execution trace
 */
export async function createAndRunWorkflowTest(
  workflowId: string,
  testLeadId?: string
): Promise<TestRunResult> {
  // Verify workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new NotFoundError('Workflow');
  }

  // Create test run entry
  const testRun = await prisma.workflowTestRun.create({
    data: {
      workflowId,
      testLeadId,
      status: 'pending',
      result: {
        workflow: {
          id: workflow.id,
          name: workflow.name,
        },
        testLeadId,
      },
      startedAt: new Date(),
    },
  });

  logger.info({
    testRunId: testRun.id,
    workflowId,
    testLeadId,
  }, 'Workflow test run created');

  // Execute the test
  return await runWorkflowTest(testRun.id);
}

/**
 * Get workflow test run results
 * @param testRunId - Test run ID
 * @returns Test run data with execution trace
 */
export async function getWorkflowTestRun(testRunId: string) {
  const testRun = await prisma.workflowTestRun.findUnique({
    where: { id: testRunId },
    include: {
      testLead: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          profileUrl: true,
          platform: true,
        },
      },
      workflow: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!testRun) {
    throw new NotFoundError('WorkflowTestRun');
  }

  return testRun;
}

/**
 * List test runs for a workflow
 * @param workflowId - Workflow ID
 * @param limit - Maximum number of test runs to return
 * @param offset - Number of test runs to skip
 * @returns Array of test runs with execution traces
 */
export async function listWorkflowTestRuns(
  workflowId: string,
  limit: number = 50,
  offset: number = 0
) {
  const testRuns = await prisma.workflowTestRun.findMany({
    where: { workflowId },
    include: {
      testLead: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.workflowTestRun.count({
    where: { workflowId },
  });

  return {
    testRuns,
    total,
    limit,
    offset,
  };
}
