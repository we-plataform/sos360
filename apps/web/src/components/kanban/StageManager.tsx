'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Trash2, Edit2, Check, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface Stage {
    id: string;
    name: string;
    color: string;
    order: number;
    leadCount?: number;
}

interface Pipeline {
    id: string;
    name: string;
    stages: Stage[];
}

interface StageManagerProps {
    pipeline: Pipeline;
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
    '#F59E0B', '#EAB308', '#22C55E', '#10B981',
    '#14B8A6', '#0EA5E9', '#3B82F6', '#64748B',
];

export function StageManager({ pipeline, isOpen, onClose }: StageManagerProps) {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState('#6366F1');

    const addStageMutation = useMutation({
        mutationFn: (data: { name: string; color: string }) =>
            api.addPipelineStage(pipeline.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline', pipeline.id] });
            setNewStageName('');
        },
    });

    const updateStageMutation = useMutation({
        mutationFn: ({ stageId, data }: { stageId: string; data: { name?: string; color?: string } }) =>
            api.updateStage(pipeline.id, stageId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline', pipeline.id] });
            setEditingId(null);
        },
    });

    const deleteStageMutation = useMutation({
        mutationFn: (stageId: string) => api.deleteStage(pipeline.id, stageId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline', pipeline.id] });
        },
    });

    const startEdit = (stage: Stage) => {
        setEditingId(stage.id);
        setEditName(stage.name);
        setEditColor(stage.color);
    };

    const saveEdit = () => {
        if (!editingId || !editName.trim()) return;
        updateStageMutation.mutate({
            stageId: editingId,
            data: { name: editName, color: editColor },
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditColor('');
    };

    const handleAddStage = () => {
        if (!newStageName.trim()) return;
        addStageMutation.mutate({ name: newStageName, color: newStageColor });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl animate-zoom-in">
                {/* Header */}
                <div className="border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-gray-500" />
                        <h2 className="text-lg font-semibold text-gray-900">Gerenciar Estágios</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Stage List */}
                    {pipeline.stages.map((stage, index) => (
                        <div
                            key={stage.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 group"
                        >
                            <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />

                            {editingId === stage.id ? (
                                <>
                                    <input
                                        type="color"
                                        value={editColor}
                                        onChange={(e) => setEditColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border-0"
                                    />
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1"
                                        autoFocus
                                    />
                                    <button
                                        onClick={saveEdit}
                                        className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: stage.color }}
                                    />
                                    <span className="flex-1 font-medium text-gray-900">{stage.name}</span>
                                    {typeof stage.leadCount === 'number' && (
                                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                            {stage.leadCount} leads
                                        </span>
                                    )}
                                    <button
                                        onClick={() => startEdit(stage)}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    {pipeline.stages.length > 1 && (
                                        <button
                                            onClick={() => deleteStageMutation.mutate(stage.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {/* Add New Stage */}
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Adicionar Estágio</h4>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={newStageColor}
                                onChange={(e) => setNewStageColor(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-0"
                            />
                            <Input
                                placeholder="Nome do estágio"
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                className="flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            />
                            <Button
                                onClick={handleAddStage}
                                disabled={!newStageName.trim() || addStageMutation.isPending}
                                size="sm"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Color Presets */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewStageColor(color)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newStageColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
