import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface AutomationAction {
    type: 'connection_request' | 'send_message' | 'move_pipeline_stage';
    config: {
        template?: string;
        delay?: number;
        pipelineStageId?: string;
    };
}

interface AutomationConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    stageId: string;
    stageName: string;
    existingAutomation?: any;
    onSave: (automation: any) => void;
}

export function AutomationConfigModal({
    isOpen,
    onClose,
    stageId,
    stageName,
    existingAutomation,
    onSave,
}: AutomationConfigModalProps) {
    const [name, setName] = useState('New Automation');
    const [actions, setActions] = useState<AutomationAction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [currentPipeline, setCurrentPipeline] = useState<any>(null);

    useEffect(() => {
        const fetchPipelines = async () => {
            try {
                const data = await api.getPipelines() as any[];
                setPipelines(data);
                // Find current pipeline
                const found = data.find((p: any) => p.stages.some((s: any) => s.id === stageId));
                setCurrentPipeline(found);
            } catch (error) {
                console.error('Failed to fetch pipelines', error);
            }
        };
        fetchPipelines();
    }, [stageId]);

    useEffect(() => {
        if (existingAutomation) {
            setName(existingAutomation.name);
            setActions(existingAutomation.actions as AutomationAction[]);
        } else {
            setName(`Automação - ${stageName}`);
            setActions([]);
        }
    }, [existingAutomation, stageName, isOpen]);

    const handleAddAction = (type: 'connection_request' | 'send_message' | 'move_pipeline_stage') => {
        const config: any = { delay: 0 };
        if (type === 'move_pipeline_stage' && currentPipeline) {
            // Default to next stage if possible, or first stage
            const currentStageIndex = currentPipeline.stages.findIndex((s: any) => s.id === stageId);
            const nextStage = currentPipeline.stages[currentStageIndex + 1];
            if (nextStage) {
                config.pipelineStageId = nextStage.id;
            }
        }
        setActions([...actions, { type, config }]);
    };

    const handleRemoveAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index));
    };

    const handleUpdateAction = (index: number, field: string, value: any) => {
        const newActions = [...actions];
        if (field === 'template') {
            newActions[index].config.template = value;
        } else if (field === 'delay') {
            newActions[index].config.delay = parseInt(value) || 0;
        } else if (field === 'pipelineStageId') {
            newActions[index].config.pipelineStageId = value;
        }
        setActions(newActions);
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const data = await api.upsertAutomation({
                pipelineStageId: stageId,
                name,
                actions,
                enabled: true,
            });
            onSave(data);
            toast.success('Automação salva com sucesso!');
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar automação');
        } finally {
            setIsLoading(false);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setActions((items) => {
                const oldIndex = items.findIndex((_, i) => `action-${i}` === active.id);
                const newIndex = items.findIndex((_, i) => `action-${i}` === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Configurar Automação: {stageName}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nome da Automação</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Conexão Automática"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Ações</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddAction('connection_request')}
                                    disabled={actions.some(a => a.type === 'connection_request')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Conexão
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddAction('send_message')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Mensagem
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddAction('move_pipeline_stage')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Mover
                                </Button>
                            </div>
                        </div>

                        {actions.length === 0 && (
                            <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
                                Nenhuma ação configurada. Adicione uma ação acima.
                            </div>
                        )}

                        <div className="space-y-3">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={actions.map((_, i) => `action-${i}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {actions.map((action, index) => (
                                        <SortableActionItem
                                            key={`action-${index}`}
                                            id={`action-${index}`}
                                            action={action}
                                            index={index}
                                            onRemove={() => handleRemoveAction(index)}
                                            onUpdate={handleUpdateAction}
                                            currentPipeline={currentPipeline}
                                            stageId={stageId}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? 'Salvando...' : 'Salvar Automação'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SortableActionItem({
    id,
    action,
    index,
    onRemove,
    onUpdate,
    currentPipeline,
    stageId
}: {
    id: string;
    action: AutomationAction;
    index: number;
    onRemove: () => void;
    onUpdate: (index: number, field: string, value: any) => void;
    currentPipeline: any;
    stageId: string;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative rounded-lg border bg-gray-50 p-4">
            <div {...attributes} {...listeners} className="absolute left-2 top-2 cursor-move text-gray-400 hover:text-gray-600">
                <GripVertical className="h-5 w-5" />
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={onRemove}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <div className="mb-2 font-medium flex items-center gap-2 pl-6">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    {index + 1}
                </div>
                {action.type === 'connection_request' && 'Enviar Pedido de Conexão'}
                {action.type === 'send_message' && 'Enviar Mensagem DM'}
                {action.type === 'move_pipeline_stage' && 'Mover para Coluna'}
            </div>

            <div className="space-y-3 pl-8">
                {action.type === 'connection_request' && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                        <Zap className="h-4 w-4" />
                        <span>A ação de conexão será enviada automaticamente sem nota.</span>
                    </div>
                )}

                {action.type === 'send_message' && (
                    <div className="grid gap-2">
                        <Label className="text-xs">Conteúdo da Mensagem</Label>
                        <Textarea
                            placeholder="Escreva sua mensagem aqui..."
                            value={action.config.template || ''}
                            onChange={(e) => onUpdate(index, 'template', e.target.value)}
                            className="h-24 text-sm"
                        />
                        <p className="text-[10px] text-gray-500">Variáveis: {'{{firstName}}'}, {'{{fullName}}'}, {'{{company}}'}</p>
                    </div>
                )}

                {action.type === 'move_pipeline_stage' && (
                    <div className="grid gap-2">
                        <Label className="text-xs">Mover para Coluna</Label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={action.config.pipelineStageId || ''}
                            onChange={(e) => onUpdate(index, 'pipelineStageId', e.target.value)}
                        >
                            <option value="" disabled>Selecione a coluna de destino</option>
                            {currentPipeline?.stages
                                .filter((s: any) => s.id !== stageId)
                                .map((stage: any) => (
                                    <option key={stage.id} value={stage.id}>
                                        {stage.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
