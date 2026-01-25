'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, X, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { KanbanStage } from './KanbanBoard';

interface EditStageDialogProps {
    pipelineId: string;
    stage: KanbanStage;
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
    '#F59E0B', '#EAB308', '#22C55E', '#10B981',
    '#14B8A6', '#0EA5E9', '#3B82F6', '#64748B',
];

export function EditStageDialog({ pipelineId, stage, isOpen, onClose }: EditStageDialogProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(stage.name);
    const [color, setColor] = useState(stage.color);

    useEffect(() => {
        if (isOpen) {
            setName(stage.name);
            setColor(stage.color);
        }
    }, [isOpen, stage.name, stage.color]);

    const updateStageMutation = useMutation({
        mutationFn: (data: { name: string; color: string }) =>
            api.updateStage(pipelineId, stage.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] });
            onClose();
        },
    });

    const handleSave = () => {
        if (!name.trim()) return;
        updateStageMutation.mutate({ name, color });
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
            <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="border-b px-6 py-4 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <Edit2 className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Editar Estágio</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 bg-gray-50 space-y-6">
                    {/* Name Input */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Nome</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nome do estágio"
                            className="bg-white"
                        />
                    </div>

                    {/* Color Selection */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Cor</label>
                        <div className="bg-white p-3 rounded-lg border">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-6 h-6 rounded-full transition-all ${color === c
                                                ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                                                : 'hover:scale-110 border border-transparent hover:border-gray-300'
                                            }`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:ring-2 ring-indigo-200 transition-all">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                                    />
                                </div>
                                <span className="text-sm text-gray-500">Ou escolha uma cor personalizada</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t px-6 py-4 bg-gray-50 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} size="sm">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} size="sm" disabled={!name.trim() || updateStageMutation.isPending}>
                        {updateStageMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
