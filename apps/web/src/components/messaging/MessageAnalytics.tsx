'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
    TrendingUp,
    TrendingDown,
    MessageSquare,
    Send,
    AlertCircle,
    Users,
    BarChart3,
    Calendar,
    RefreshCw,
    CheckCircle,
    XCircle,
    Target,
    Filter,
    Clock,
} from 'lucide-react';

// Types
export interface MessagingAnalytics {
    overview: {
        total: number;
        sent: number;
        failed: number;
        pending: number;
        queued: number;
        blocked: number;
        deliveryRate: number;
        failureRate: number;
    };
    byPlatform: {
        platform: 'linkedin' | 'instagram';
        total: number;
        sent: number;
        failed: number;
    }[];
    byMessageType: {
        messageType: string;
        total: number;
        sent: number;
        failed: number;
    }[];
    byStatus: {
        status: string;
        count: number;
    }[];
    conversions: {
        leadId: string;
        leadName: string;
        messagesSent: number;
        currentStage: string;
    }[];
    agentPerformance: {
        agentId: string;
        agentName: string;
        total: number;
        sent: number;
        failed: number;
        successRate: number;
    }[];
    averageResponseTime: number; // in milliseconds
    recentFailures: {
        messageId: string;
        platform: string;
        error: string;
        leadName: string;
        timestamp: string;
    }[];
}

export interface MessageAnalyticsProps {
    workspaceId: string;
    agentId?: string;
}

export function MessageAnalytics({ workspaceId, agentId }: MessageAnalyticsProps) {
    // State
    const [analytics, setAnalytics] = useState<MessagingAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [timeRange, setTimeRange] = useState<number>(30); // days
    const [platformFilter, setPlatformFilter] = useState<string>('all');

    // Load analytics
    const loadAnalytics = async () => {
        try {
            const response = await api.getMessagingAnalytics({
                days: timeRange,
                platform: platformFilter !== 'all' ? platformFilter : undefined,
            });
            setAnalytics(response);
        } catch (err) {
            console.error('Failed to load analytics:', err);
            setError('Failed to load analytics');
        }
    };

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            await loadAnalytics();
            setLoading(false);
        };
        loadData();
    }, [timeRange, platformFilter]);

    // Refresh handler
    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        await loadAnalytics();
        setRefreshing(false);
    };

    // Helper functions
    const formatPercentage = (value: number): string => {
        return `${value.toFixed(1)}%`;
    };

    const formatDuration = (ms: number): string => {
        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    const getTrendIcon = (value: number, reverse = false) => {
        const isPositive = reverse ? value < 0 : value > 0;
        return isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
        );
    };

    const getPlatformIcon = (platform: string) => {
        return platform === 'linkedin' ? '💼' : '📸';
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'sent':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'queued':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'blocked':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <div className="space-y-2">
                                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Message Analytics</h2>
                    <p className="text-muted-foreground">
                        Track your messaging performance and insights
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">{error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Time Range</label>
                            <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select time range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                    <SelectItem value="365">Last year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-2 block">Platform</label>
                            <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All platforms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Platforms</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn 💼</SelectItem>
                                    <SelectItem value="instagram">Instagram 📸</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Overview Statistics */}
            {analytics && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Delivery Rate */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                                <Send className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatPercentage(analytics.overview.deliveryRate)}
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    {getTrendIcon(analytics.overview.deliveryRate, true)}
                                    <span>
                                        {analytics.overview.sent} of {analytics.overview.total} delivered
                                    </span>
                                </p>
                                <div className="mt-3 h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-600 rounded-full transition-all"
                                        style={{ width: `${analytics.overview.deliveryRate}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Failure Rate */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatPercentage(analytics.overview.failureRate)}
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    {getTrendIcon(analytics.overview.failureRate, true)}
                                    <span>{analytics.overview.failed} failed</span>
                                </p>
                                <div className="mt-3 h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-red-600 rounded-full transition-all"
                                        style={{ width: `${analytics.overview.failureRate}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Average Response Time */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatDuration(analytics.averageResponseTime)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    From queue to delivery
                                </p>
                            </CardContent>
                        </Card>

                        {/* Active Leads */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{analytics.conversions.length}</div>
                                <p className="text-xs text-muted-foreground">
                                    Leads with messages
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Platform Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Performance by Platform
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {analytics.byPlatform.map((platform) => {
                                    const successRate =
                                        platform.total > 0
                                            ? (platform.sent / platform.total) * 100
                                            : 0;
                                    return (
                                        <div key={platform.platform} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">
                                                        {getPlatformIcon(platform.platform)}
                                                    </span>
                                                    <span className="font-medium capitalize">
                                                        {platform.platform}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="text-muted-foreground">
                                                        {platform.sent} sent
                                                    </span>
                                                    <span className="text-red-600">
                                                        {platform.failed} failed
                                                    </span>
                                                    <span className="font-semibold">
                                                        {formatPercentage(successRate)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-600 rounded-full transition-all"
                                                    style={{ width: `${successRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                Performance by Agent
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {analytics.agentPerformance.map((agent) => (
                                    <div
                                        key={agent.agentId}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{agent.agentName}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        agent.successRate >= 80
                                                            ? 'border-green-600 text-green-600'
                                                            : agent.successRate >= 50
                                                            ? 'border-yellow-600 text-yellow-600'
                                                            : 'border-red-600 text-red-600'
                                                    )}
                                                >
                                                    {formatPercentage(agent.successRate)}
                                                </Badge>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full transition-all',
                                                        agent.successRate >= 80
                                                            ? 'bg-green-600'
                                                            : agent.successRate >= 50
                                                            ? 'bg-yellow-600'
                                                            : 'bg-red-600'
                                                    )}
                                                    style={{ width: `${agent.successRate}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>{agent.total} total</span>
                                                <span className="text-green-600">
                                                    {agent.sent} sent
                                                </span>
                                                <span className="text-red-600">
                                                    {agent.failed} failed
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {analytics.agentPerformance.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No agent performance data available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Message Type Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Breakdown by Message Type
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {analytics.byMessageType.map((type) => {
                                    const successRate =
                                        type.total > 0 ? (type.sent / type.total) * 100 : 0;
                                    return (
                                        <div
                                            key={type.messageType}
                                            className="p-4 border rounded-lg space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium capitalize">
                                                    {type.messageType.replace('_', ' ')}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        successRate >= 80
                                                            ? 'border-green-600 text-green-600'
                                                            : successRate >= 50
                                                            ? 'border-yellow-600 text-yellow-600'
                                                            : 'border-red-600 text-red-600'
                                                    )}
                                                >
                                                    {formatPercentage(successRate)}
                                                </Badge>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full transition-all',
                                                        successRate >= 80
                                                            ? 'bg-green-600'
                                                            : successRate >= 50
                                                            ? 'bg-yellow-600'
                                                            : 'bg-red-600'
                                                    )}
                                                    style={{ width: `${successRate}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span>{type.total} total</span>
                                                <span className="text-green-600">{type.sent} sent</span>
                                                <span className="text-red-600">
                                                    {type.failed} failed
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {analytics.byMessageType.length === 0 && (
                                    <div className="col-span-3 text-center py-8 text-muted-foreground">
                                        No message type data available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Failures */}
                    {analytics.recentFailures.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    Recent Failures
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {analytics.recentFailures.map((failure) => (
                                        <div
                                            key={failure.messageId}
                                            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                        >
                                            <span className="text-xl">
                                                {getPlatformIcon(failure.platform)}
                                            </span>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {failure.leadName}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(failure.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-red-600">
                                                    <XCircle className="h-4 w-4" />
                                                    <span>{failure.error}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Conversions - Leads with Messages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5" />
                                Leads with Messages
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {analytics.conversions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No conversion data available
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {analytics.conversions.map((conversion) => (
                                        <div
                                            key={conversion.leadId}
                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium">{conversion.leadName}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {conversion.messagesSent} message
                                                    {conversion.messagesSent !== 1 ? 's' : ''} sent
                                                </div>
                                            </div>
                                            <Badge className={getStatusColor(conversion.currentStage)}>
                                                {conversion.currentStage}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
