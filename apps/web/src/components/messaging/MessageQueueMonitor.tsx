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
    MessageSquare,
    Clock,
    Send,
    AlertCircle,
    CheckCircle,
    XCircle,
    Pause,
    RefreshCw,
    Trash2,
    RotateCcw,
    Filter,
} from 'lucide-react';

// Types
export interface MessageQueueStats {
    total: number;
    queued: number;
    pending: number;
    sent: number;
    failed: number;
    blocked: number;
    cancelled: number;
}

export interface QueuedMessage {
    id: string;
    platform: 'linkedin' | 'instagram';
    messageType: 'connection_request' | 'first_message' | 'follow_up';
    status: 'queued' | 'pending' | 'sent' | 'failed' | 'blocked' | 'cancelled';
    content: string;
    scheduledAt: string;
    sentAt?: string;
    attempts: number;
    lastError?: string;
    lead: {
        id: string;
        fullName: string | null;
        username: string | null;
        avatarUrl: string | null;
    };
    agent: {
        id: string;
        name: string;
    };
}

export interface MessageQueueMonitorProps {
    workspaceId: string;
    agentId?: string;
}

export function MessageQueueMonitor({ workspaceId, agentId }: MessageQueueMonitorProps) {
    // State
    const [stats, setStats] = useState<MessageQueueStats | null>(null);
    const [messages, setMessages] = useState<QueuedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [platformFilter, setPlatformFilter] = useState<string>('all');
    const [agentFilter, setAgentFilter] = useState<string>(agentId || 'all');

    // Load queue statistics
    const loadStats = async () => {
        try {
            const response = await api.getMessageQueue({
                status: statusFilter !== 'all' ? statusFilter : undefined,
                platform: platformFilter !== 'all' ? platformFilter : undefined,
                agentId: agentFilter !== 'all' ? agentFilter : undefined,
            });
            setStats(response);
        } catch (err) {
            console.error('Failed to load queue stats:', err);
            setError('Failed to load queue statistics');
        }
    };

    // Load messages
    const loadMessages = async () => {
        try {
            const response = await api.getMessages({
                status: statusFilter !== 'all' ? statusFilter : undefined,
                platform: platformFilter !== 'all' ? platformFilter : undefined,
                agentId: agentFilter !== 'all' ? agentFilter : undefined,
                limit: 50,
            });
            setMessages(response.messages || []);
        } catch (err) {
            console.error('Failed to load messages:', err);
            setError('Failed to load messages');
        }
    };

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            await Promise.all([loadStats(), loadMessages()]);
            setLoading(false);
        };
        loadData();
    }, [statusFilter, platformFilter, agentFilter]);

    // Refresh handler
    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        await Promise.all([loadStats(), loadMessages()]);
        setRefreshing(false);
    };

    // Message actions
    const handleCancel = async (messageId: string) => {
        try {
            await api.cancelMessage(messageId);
            await handleRefresh();
        } catch (err) {
            console.error('Failed to cancel message:', err);
            setError('Failed to cancel message');
        }
    };

    const handleRetry = async (messageId: string) => {
        try {
            await api.retryMessage(messageId);
            await handleRefresh();
        } catch (err) {
            console.error('Failed to retry message:', err);
            setError('Failed to retry message');
        }
    };

    const handleDelete = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }
        try {
            await api.deleteMessage(messageId);
            await handleRefresh();
        } catch (err) {
            console.error('Failed to delete message:', err);
            setError('Failed to delete message');
        }
    };

    // Status helpers
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'queued':
                return <Clock className="h-4 w-4 text-blue-600" />;
            case 'pending':
                return <Send className="h-4 w-4 text-yellow-600" />;
            case 'sent':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case 'blocked':
                return <Pause className="h-4 w-4 text-orange-600" />;
            case 'cancelled':
                return <XCircle className="h-4 w-4 text-gray-600" />;
            default:
                return <MessageSquare className="h-4 w-4" />;
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'queued':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'sent':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'blocked':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
            default:
                return '';
        }
    };

    const getPlatformIcon = (platform: string) => {
        return platform === 'linkedin' ? '💼' : '📸';
    };

    // Loading state
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
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
                    <h2 className="text-2xl font-bold tracking-tight">Message Queue</h2>
                    <p className="text-muted-foreground">
                        Monitor and manage your message queue
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

            {/* Queue Statistics */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">All messages</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Queued</CardTitle>
                            <Clock className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.queued}</div>
                            <p className="text-xs text-muted-foreground">Waiting to send</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            <Send className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <p className="text-xs text-muted-foreground">In progress</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sent</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.sent}</div>
                            <p className="text-xs text-muted-foreground">Delivered</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Failed</CardTitle>
                            <XCircle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.failed}</div>
                            <p className="text-xs text-muted-foreground">Needs retry</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                            <Pause className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.blocked}</div>
                            <p className="text-xs text-muted-foreground">Account blocked</p>
                        </CardContent>
                    </Card>
                </div>
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
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="queued">Queued</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="blocked">Blocked</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
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

                        {!agentId && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-sm font-medium mb-2 block">Agent</label>
                                <Select value={agentFilter} onValueChange={setAgentFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All agents" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Agents</SelectItem>
                                        {/* Agent options would be loaded dynamically */}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Messages List */}
            <Card>
                <CardHeader>
                    <CardTitle>Messages ({messages.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {messages.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No messages found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1 space-y-2">
                                        {/* Header */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">
                                                {getPlatformIcon(message.platform)}
                                            </span>
                                            <Badge className={getStatusColor(message.status)}>
                                                <div className="flex items-center gap-1">
                                                    {getStatusIcon(message.status)}
                                                    <span className="capitalize">{message.status}</span>
                                                </div>
                                            </Badge>
                                            <Badge variant="outline" className="capitalize">
                                                {message.messageType.replace('_', ' ')}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(message.scheduledAt).toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Lead info */}
                                        <div className="flex items-center gap-2">
                                            {message.lead.avatarUrl && (
                                                <img
                                                    src={message.lead.avatarUrl}
                                                    alt={message.lead.fullName || message.lead.username || 'Lead'}
                                                    className="h-6 w-6 rounded-full"
                                                />
                                            )}
                                            <span className="font-medium">
                                                {message.lead.fullName || message.lead.username || 'Unknown'}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                via {message.agent.name}
                                            </span>
                                        </div>

                                        {/* Content preview */}
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {message.content}
                                        </p>

                                        {/* Error message */}
                                        {message.lastError && (
                                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>{message.lastError}</span>
                                            </div>
                                        )}

                                        {/* Attempts */}
                                        {message.attempts > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Attempts: {message.attempts}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        {message.status === 'queued' || message.status === 'pending' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCancel(message.id)}
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        {message.status === 'failed' || message.status === 'blocked' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRetry(message.id)}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        {message.status !== 'sent' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDelete(message.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
