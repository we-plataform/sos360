'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Search,
    Copy,
    Zap,
    MessageCircle,
    Users,
    Clock,
    Webhook,
    Sparkles,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { WorkflowTemplate } from '@lia360/shared';

interface WorkflowTemplatesProps {
    onSelectTemplate?: (templateId: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
    'welcome': <MessageCircle className="h-5 w-5" />,
    'nurturing': <Users className="h-5 w-5" />,
    'follow-up': <Clock className="h-5 w-5" />,
    'automation': <Zap className="h-5 w-5" />,
    'webhook': <Webhook className="h-5 w-5" />,
    'default': <Sparkles className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
    'welcome': 'bg-blue-100 text-blue-700 border-blue-200',
    'nurturing': 'bg-green-100 text-green-700 border-green-200',
    'follow-up': 'bg-orange-100 text-orange-700 border-orange-200',
    'automation': 'bg-purple-100 text-purple-700 border-purple-200',
    'webhook': 'bg-pink-100 text-pink-700 border-pink-200',
    'default': 'bg-gray-100 text-gray-700 border-gray-200',
};

export function WorkflowTemplates({ onSelectTemplate }: WorkflowTemplatesProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

    const { data: templates = [], isLoading, error } = useQuery({
        queryKey: ['workflow-templates', selectedCategory, search],
        queryFn: () => api.getWorkflowTemplates({
            category: selectedCategory,
            search: search || undefined,
        }) as Promise<WorkflowTemplate[]>,
    });

    if (error) {
        toast.error('Failed to load workflow templates');
    }

    const instantiateMutation = useMutation({
        mutationFn: ({ templateId, name }: { templateId: string; name: string }) =>
            api.createWorkflowFromTemplate(templateId, { name }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['workflows'] });
            toast.success('Workflow created successfully from template');
            if (onSelectTemplate) {
                onSelectTemplate(data.id);
            } else {
                router.push(`/dashboard/automations/${data.id}/edit`);
            }
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create workflow from template');
        },
    });

    const categories = Array.from(
        new Set(templates.map((t) => t.category || 'default'))
    ).sort();

    const filteredTemplates = templates.filter((template) =>
        template.name.toLowerCase().includes(search.toLowerCase()) ||
        template.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleUseTemplate = (template: WorkflowTemplate) => {
        const defaultName = `${template.name} (Copy)`;
        const name = prompt(`Enter a name for your workflow:`, defaultName);
        if (name) {
            instantiateMutation.mutate({
                templateId: template.id,
                name,
            });
        }
    };

    const getCategoryIcon = (category?: string) => {
        return categoryIcons[category || 'default'] || categoryIcons.default;
    };

    const getCategoryColor = (category?: string) => {
        return categoryColors[category || 'default'] || categoryColors.default;
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Workflow Templates</h2>
                <p className="text-gray-600">
                    Start with a pre-built template to accelerate your workflow creation
                </p>
            </div>

            {/* Search and Filters */}
            <Card className="mb-6 p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search templates..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Category Filter */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <Button
                        variant={selectedCategory === undefined ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(undefined)}
                    >
                        All Categories
                    </Button>
                    {categories.map((category) => (
                        <Button
                            key={category}
                            variant={selectedCategory === category ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(category)}
                            className="capitalize"
                        >
                            {category}
                        </Button>
                    ))}
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                </div>
            ) : filteredTemplates.length === 0 ? (
                <Card className="flex h-64 flex-col items-center justify-center">
                    <Copy className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">
                        {search ? 'No templates found' : 'No templates available'}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => handleUseTemplate(template)}
                        >
                            {/* Template Header */}
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${getCategoryColor(template.category)}`}>
                                            {getCategoryIcon(template.category)}
                                        </div>
                                        {template.isSystem && (
                                            <Badge variant="secondary" className="text-xs">
                                                System
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Template Name */}
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    {template.name}
                                </h3>

                                {/* Template Description */}
                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                    {template.description || 'No description available'}
                                </p>

                                {/* Template Stats */}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                    <div className="flex items-center gap-1">
                                        <Copy className="h-4 w-4" />
                                        <span>{template.stats?.uses || 0} uses</span>
                                    </div>
                                    {template.nodes && (
                                        <div className="flex items-center gap-1">
                                            <Zap className="h-4 w-4" />
                                            <span>{template.nodes.length} nodes</span>
                                        </div>
                                    )}
                                </div>

                                {/* Category Badge */}
                                {template.category && (
                                    <Badge variant="outline" className="mb-4 capitalize">
                                        {template.category}
                                    </Badge>
                                )}

                                {/* Use Template Button */}
                                <Button
                                    className="w-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUseTemplate(template);
                                    }}
                                    disabled={instantiateMutation.isPending}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Use Template
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Results Count */}
            {filteredTemplates.length > 0 && (
                <div className="mt-6 text-sm text-gray-500">
                    {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                </div>
            )}
        </div>
    );
}
