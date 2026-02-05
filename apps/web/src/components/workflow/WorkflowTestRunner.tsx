'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Play, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { WorkflowTestRun, WorkflowTestRunStatus } from '@lia360/shared';

interface WorkflowTestRunnerProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
    workflowName: string;
}

interface TestLead {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string | null;
    profileUrl: string | null;
    platform: string | null;
}

interface ExecutionState {
    currentNodeId?: string;
    visitedNodes: string[];
    completedNodes: string[];
    skippedNodes: string[];
    errors: Array<{ nodeId: string; error: string }>;
    status: 'running' | 'completed' | 'failed' | 'paused';
}

interface TestResult {
    success: boolean;
    state: ExecutionState;
    actionsTaken: Array<{ type: string; config: Record<string, unknown> }>;
    error?: string;
}

const STATUS_ICONS: Record<WorkflowTestRunStatus, React.ReactNode> = {
    pending: <Loader2 className="w-4 h-4 animate-spin" />,
    running: <Loader2 className="w-4 h-4 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
};

const NODE_TYPE_LABELS: Record<string, string> = {
    'trigger_lead_stage_entry': 'Trigger: Lead Stage Entry',
    'trigger_lead_score_change': 'Trigger: Score Change',
    'trigger_lead_field_change': 'Trigger: Field Change',
    'trigger_time_based': 'Trigger: Time Based',
    'trigger_webhook': 'Trigger: Webhook',
    'trigger_manual': 'Trigger: Manual',
    'action_send_message': 'Send Message',
    'action_add_tag': 'Add Tag',
    'action_remove_tag': 'Remove Tag',
    'action_assign_user': 'Assign User',
    'action_change_stage': 'Change Stage',
    'action_update_lead_field': 'Update Field',
    'action_enqueue_agent': 'Enqueue Agent',
    'action_send_webhook': 'Send Webhook',
    'action_add_to_audience': 'Add to Audience',
    'action_remove_from_audience': 'Remove from Audience',
    'action_wait_until_time': 'Wait Until Time',
    'action_increment_score': 'Increment Score',
    'action_decrement_score': 'Decrement Score',
    'condition': 'Condition',
    'delay': 'Delay',
    'loop': 'Loop',
    'end': 'End',
};

export function WorkflowTestRunner({
    isOpen,
    onClose,
    workflowId,
    workflowName,
}: WorkflowTestRunnerProps) {
    const [testLeads, setTestLeads] = useState<TestLead[]>([]);
    const [selectedTestLeadId, setSelectedTestLeadId] = useState<string>('');
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const [isRunningTest, setIsRunningTest] = useState(false);
    const [testRunId, setTestRunId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testRunStatus, setTestRunStatus] = useState<WorkflowTestRunStatus>('pending');

    // Load leads for testing when dialog opens
    useEffect(() => {
        if (isOpen) {
            loadTestLeads();
        }
    }, [isOpen]);

    // Poll for test results if running
    useEffect(() => {
        if (testRunId && testRunStatus === 'running') {
            const interval = setInterval(async () => {
                try {
                    const result = await api.getWorkflowTestRun(workflowId, testRunId) as WorkflowTestRun;
                    setTestRunStatus(result.status);

                    if (result.status === 'completed' || result.status === 'failed') {
                        clearInterval(interval);
                        setIsRunningTest(false);

                        // Parse execution result
                        const executionResult = result.result as unknown as TestResult;
                        setTestResult(executionResult);

                        if (result.status === 'completed') {
                            toast.success('Test completed successfully');
                        } else {
                            toast.error('Test execution failed');
                        }
                    }
                } catch (error) {
                    clearInterval(interval);
                    setIsRunningTest(false);
                    toast.error('Failed to fetch test results');
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [testRunId, testRunStatus, workflowId]);

    const loadTestLeads = async () => {
        setIsLoadingLeads(true);
        try {
            const response = await api.getLeads({ limit: '50' }) as TestLead[];
            setTestLeads(response);
        } catch (error) {
            toast.error('Failed to load test leads');
        } finally {
            setIsLoadingLeads(false);
        }
    };

    const handleRunTest = async () => {
        setIsRunningTest(true);
        setTestResult(null);
        setTestRunStatus('pending');

        try {
            const response = await api.testWorkflow(
                workflowId,
                selectedTestLeadId || undefined
            ) as { testRunId: string };

            setTestRunId(response.testRunId);
            setTestRunStatus('running');

            // Start polling for results
            toast.info('Test started, monitoring progress...');
        } catch (error) {
            setIsRunningTest(false);
            toast.error('Failed to start test run');
        }
    };

    const handleClose = () => {
        setTestResult(null);
        setTestRunId(null);
        setTestRunStatus('pending');
        setSelectedTestLeadId('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Test Workflow: {workflowName}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Test Configuration */}
                    {!testResult && (
                        <>
                            <div className="flex items-center gap-4 p-4 bg-secondary/20 rounded-lg border border-secondary">
                                <div className="bg-primary/10 p-3 rounded-md text-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-primary">{testLeads.length}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Test Leads</div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Select a lead to test the workflow with, or leave empty to use a mock lead.
                                    The workflow will execute in dry-run mode (no side effects).
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="testLead">Test Lead (Optional)</Label>
                                {isLoadingLeads ? (
                                    <div className="flex items-center justify-center h-10 border rounded-md">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <select
                                        id="testLead"
                                        value={selectedTestLeadId}
                                        onChange={(e) => setSelectedTestLeadId(e.target.value)}
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="">Use Mock Lead (Recommended for Testing)</option>
                                        {testLeads.map((lead) => (
                                            <option key={lead.id} value={lead.id}>
                                                {lead.fullName || lead.username || lead.email || `Lead ${lead.id}`}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                    Dry-run mode simulates execution without actually modifying leads or sending messages
                                </p>
                            </div>

                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                                <AlertCircle className="w-3 h-3" />
                                <span>Test runs are saved to execution history for debugging purposes.</span>
                            </div>
                        </>
                    )}

                    {/* Test Results */}
                    {testResult && (
                        <div className="space-y-4">
                            {/* Status Summary */}
                            <div className={`flex items-center gap-4 p-4 rounded-lg border ${
                                testResult.success
                                    ? 'bg-green-500/10 border-green-500/20'
                                    : 'bg-red-500/10 border-red-500/20'
                            }`}>
                                <div className={`p-3 rounded-md ${
                                    testResult.success ? 'bg-green-500/20' : 'bg-red-500/20'
                                }`}>
                                    {testResult.success ? (
                                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                                    ) : (
                                        <XCircle className="w-8 h-8 text-red-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-lg font-semibold">
                                        {testResult.success ? 'Test Passed' : 'Test Failed'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {testResult.error || 'Workflow executed successfully in dry-run mode'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-primary">
                                        {testResult.state.visitedNodes.length}
                                    </div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                        Nodes Visited
                                    </div>
                                </div>
                            </div>

                            {/* Execution Trace */}
                            <div className="space-y-2 pt-2">
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Execution Trace:</h4>

                                {/* Visited Nodes */}
                                {testResult.state.visitedNodes.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                                            Visited Nodes ({testResult.state.visitedNodes.length})
                                        </div>
                                        <div className="border rounded-md p-3 bg-muted/30 space-y-1">
                                            {testResult.state.visitedNodes.map((nodeId, index) => (
                                                <div key={nodeId} className="flex items-center gap-2 text-sm">
                                                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                                    <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{nodeId}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions Taken */}
                                {testResult.actionsTaken.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                            Actions That Would Run ({testResult.actionsTaken.length})
                                        </div>
                                        <div className="space-y-2">
                                            {testResult.actionsTaken.map((action, index) => (
                                                <div key={index} className="border rounded-md p-3 flex items-center justify-between bg-blue-500/10 border-blue-500/20">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                                        <span className="text-sm font-medium">
                                                            {index + 1}. {NODE_TYPE_LABELS[action.type] || action.type}
                                                        </span>
                                                    </div>
                                                    <Play className="w-3 h-3 text-blue-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Completed Nodes */}
                                {testResult.state.completedNodes.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                                            Completed Nodes ({testResult.state.completedNodes.length})
                                        </div>
                                        <div className="border rounded-md p-3 bg-purple-500/10 border-purple-500/20">
                                            {testResult.state.completedNodes.map((nodeId) => (
                                                <span key={nodeId} className="inline-block bg-purple-500/20 text-purple-700 px-2 py-1 rounded text-xs font-mono mr-1 mb-1">
                                                    {nodeId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Errors */}
                                {testResult.state.errors.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                                            Errors ({testResult.state.errors.length})
                                        </div>
                                        <div className="space-y-2">
                                            {testResult.state.errors.map((error, index) => (
                                                <div key={index} className="border rounded-md p-3 bg-red-500/10 border-red-500/20">
                                                    <div className="text-sm font-medium text-red-700">
                                                        Node: {error.nodeId}
                                                    </div>
                                                    <div className="text-xs text-red-600 mt-1">
                                                        {error.error}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Skipped Nodes */}
                                {testResult.state.skippedNodes.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Skipped Nodes ({testResult.state.skippedNodes.length})
                                        </div>
                                        <div className="border rounded-md p-3 bg-muted/30">
                                            {testResult.state.skippedNodes.map((nodeId) => (
                                                <span key={nodeId} className="inline-block bg-muted text-muted-foreground px-2 py-1 rounded text-xs font-mono mr-1 mb-1">
                                                    {nodeId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isRunningTest}>
                        {testResult ? 'Close' : 'Cancel'}
                    </Button>
                    {!testResult && (
                        <Button
                            onClick={handleRunTest}
                            disabled={isRunningTest}
                            className="bg-pink-600 hover:bg-pink-700 text-white gap-2 min-w-[200px]"
                        >
                            {isRunningTest ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Running Test...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Run Test
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
