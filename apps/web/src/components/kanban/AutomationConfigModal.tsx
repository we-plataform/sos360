import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
<<<<<<< HEAD
import {
  Plus,
  Trash2,
  Zap,
  MessageSquare,
  UserPlus,
  ArrowRight,
  GripVertical,
  PlayCircle,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
=======
import { Plus, Trash2, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
>>>>>>> origin/main
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
<<<<<<< HEAD
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
=======
import { GripVertical } from "lucide-react";
>>>>>>> origin/main

interface AutomationAction {
  type: "connection_request" | "send_message" | "move_pipeline_stage";
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
  const [name, setName] = useState("New Automation");
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [currentPipeline, setCurrentPipeline] = useState<any>(null);

  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const data = (await api.getPipelines()) as any[];
        setPipelines(data);
        // Find current pipeline
        const found = data.find((p: any) =>
          p.stages.some((s: any) => s.id === stageId),
        );
        setCurrentPipeline(found);
      } catch (error) {
        console.error("Failed to fetch pipelines", error);
      }
    };
<<<<<<< HEAD
    if (isOpen) {
      fetchPipelines();
    }
  }, [stageId, isOpen]);
=======
    fetchPipelines();
  }, [stageId]);
>>>>>>> origin/main

  useEffect(() => {
    if (existingAutomation) {
      setName(existingAutomation.name);
      setActions(existingAutomation.actions as AutomationAction[]);
    } else {
      setName(`Automação - ${stageName}`);
      setActions([]);
    }
  }, [existingAutomation, stageName, isOpen]);

  const handleAddAction = (
    type: "connection_request" | "send_message" | "move_pipeline_stage",
  ) => {
    const config: any = { delay: 0 };
    if (type === "move_pipeline_stage" && currentPipeline) {
      // Default to next stage if possible, or first stage
      const currentStageIndex = currentPipeline.stages.findIndex(
        (s: any) => s.id === stageId,
      );
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
    if (field === "template") {
      newActions[index].config.template = value;
    } else if (field === "delay") {
      newActions[index].config.delay = parseInt(value) || 0;
    } else if (field === "pipelineStageId") {
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
      toast.success("Automação salva com sucesso!");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar automação");
    } finally {
      setIsLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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
<<<<<<< HEAD
      <DialogContent className="sm:max-w-[700px] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-950">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-800 p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white dark:bg-zinc-800 rounded-lg flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-700">
              <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Criador de Automação
              </DialogTitle>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Define ações automáticas quando um lead entra em{" "}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {stageName}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Body (Timeline) */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950 p-6">
          <div className="max-w-2xl mx-auto">
            {/* Trigger Node */}
            <div className="flex gap-4 mb-6">
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 z-10 relative">
                  <PlayCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                {actions.length > 0 && (
                  <div className="w-0.5 h-full bg-zinc-200 dark:bg-zinc-800 -mt-2 -mb-2" />
                )}
              </div>
              <div className="pt-2">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Gatilho Inicial
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Quando um lead é movido para este estágio
                </div>
              </div>
            </div>

            {/* Actions */}
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
                    isLast={index === actions.length - 1}
                    onRemove={() => handleRemoveAction(index)}
                    onUpdate={handleUpdateAction}
                    currentPipeline={currentPipeline}
                    stageId={stageId}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add Button */}
            <div className="flex gap-4 mt-2">
              <div className="flex flex-col items-center w-10">
                {actions.length > 0 && (
                  <div className="w-0.5 h-6 bg-zinc-200 dark:bg-zinc-800 -mt-2" />
                )}
                <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700 mt-1" />
              </div>
              <div className="pt-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Próximo Passo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem
                      onClick={() => handleAddAction("connection_request")}
                      disabled={actions.some(
                        (a) => a.type === "connection_request",
                      )}
                    >
                      <UserPlus className="h-4 w-4 mr-2 text-blue-500" />
                      Pedido de Conexão
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAddAction("send_message")}
                    >
                      <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
                      Enviar Mensagem
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAddAction("move_pipeline_stage")}
                    >
                      <ArrowRight className="h-4 w-4 mr-2 text-orange-500" />
                      Mover para Coluna
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
=======
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
                  onClick={() => handleAddAction("connection_request")}
                  disabled={actions.some(
                    (a) => a.type === "connection_request",
                  )}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Conexão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddAction("send_message")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Mensagem
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddAction("move_pipeline_stage")}
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
>>>>>>> origin/main
            </div>
          </div>
        </div>

<<<<<<< HEAD
        <DialogFooter className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? "Salvando..." : "Salvar Fluxo"}
=======
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Automação"}
>>>>>>> origin/main
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
<<<<<<< HEAD
  isLast,
=======
>>>>>>> origin/main
  onRemove,
  onUpdate,
  currentPipeline,
  stageId,
}: {
  id: string;
  action: AutomationAction;
  index: number;
<<<<<<< HEAD
  isLast: boolean;
=======
>>>>>>> origin/main
  onRemove: () => void;
  onUpdate: (index: number, field: string, value: any) => void;
  currentPipeline: any;
  stageId: string;
}) {
<<<<<<< HEAD
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
=======
  const { attributes, listeners, setNodeRef, transform, transition } =
>>>>>>> origin/main
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
<<<<<<< HEAD
    zIndex: isDragging ? 50 : 1,
  };

  const getActionIcon = () => {
    switch (action.type) {
      case "connection_request":
        return <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case "send_message":
        return <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "move_pipeline_stage":
        return <ArrowRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
    }
  };

  const getActionColor = () => {
    switch (action.type) {
      case "connection_request":
        return "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20";
      case "send_message":
        return "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20";
      case "move_pipeline_stage":
        return "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/20";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex gap-4 ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Timeline Line */}
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border shadow-sm flex items-center justify-center shrink-0 z-10 relative">
          <div
            {...attributes}
            {...listeners}
            className="cursor-move hover:text-indigo-500 transition-colors"
          >
            <GripVertical className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
        {!isLast && (
          <div className="w-0.5 h-full bg-zinc-200 dark:bg-zinc-800 -mt-2 -mb-2 min-h-[30px]" />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <div
          className={`group rounded-xl border p-4 shadow-sm bg-white dark:bg-zinc-900 hover:shadow-md transition-shadow ${isDragging ? "ring-2 ring-indigo-500" : ""
            }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center border ${getActionColor()}`}
              >
                {getActionIcon()}
              </div>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {action.type === "connection_request" &&
                    "Enviar Pedido de Conexão"}
                  {action.type === "send_message" && "Enviar Mensagem DM"}
                  {action.type === "move_pipeline_stage" && "Mover para Coluna"}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs text-zinc-500">
                    Atraso:{" "}
                    {action.config.delay && action.config.delay > 0
                      ? `${action.config.delay} min`
                      : "Imediato"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="pl-[52px] space-y-4">
            {/* Delay Input */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-zinc-500 w-20 shrink-0">
                Esperar (min):
              </Label>
              <Input
                type="number"
                min="0"
                value={action.config.delay || 0}
                onChange={(e) => onUpdate(index, "delay", e.target.value)}
                className="h-8 w-24 text-xs"
              />
            </div>

            {action.type === "connection_request" && (
              <div className="text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-md border border-zinc-100 dark:border-zinc-800">
                <p>
                  O LinkedIn limita os pedidos diários. Esta ação entrará na fila
                  inteligente.
                </p>
              </div>
            )}

            {action.type === "send_message" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Mensagem
                </Label>
                <Textarea
                  placeholder="Olá {{firstName}}, vi que você trabalha na {{company}}..."
                  value={action.config.template || ""}
                  onChange={(e) => onUpdate(index, "template", e.target.value)}
                  className="min-h-[100px] text-sm resize-none bg-zinc-50 dark:bg-zinc-800/50"
                />
                <div className="flex gap-2">
                  {["firstName", "fullName", "company", "title"].map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        const newVal = (action.config.template || "") + ` {{${v}}}`;
                        onUpdate(index, "template", newVal);
                      }}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {action.type === "move_pipeline_stage" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-zinc-500 w-20 shrink-0">
                  Destino:
                </Label>
                <select
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={action.config.pipelineStageId || ""}
                  onChange={(e) =>
                    onUpdate(index, "pipelineStageId", e.target.value)
                  }
                >
                  <option value="" disabled>
                    Selecione a coluna...
                  </option>
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
=======
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg border bg-gray-50 p-4"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 cursor-move text-gray-400 hover:text-gray-600"
      >
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
        {action.type === "connection_request" && "Enviar Pedido de Conexão"}
        {action.type === "send_message" && "Enviar Mensagem DM"}
        {action.type === "move_pipeline_stage" && "Mover para Coluna"}
      </div>

      <div className="space-y-3 pl-8">
        {action.type === "connection_request" && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
            <Zap className="h-4 w-4" />
            <span>
              A ação de conexão será enviada automaticamente sem nota.
            </span>
          </div>
        )}

        {action.type === "send_message" && (
          <div className="grid gap-2">
            <Label className="text-xs">Conteúdo da Mensagem</Label>
            <Textarea
              placeholder="Escreva sua mensagem aqui..."
              value={action.config.template || ""}
              onChange={(e) => onUpdate(index, "template", e.target.value)}
              className="h-24 text-sm"
            />
            <p className="text-[10px] text-gray-500">
              Variáveis: {"{{firstName}}"}, {"{{fullName}}"}, {"{{company}}"}
            </p>
          </div>
        )}

        {action.type === "move_pipeline_stage" && (
          <div className="grid gap-2">
            <Label className="text-xs">Mover para Coluna</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={action.config.pipelineStageId || ""}
              onChange={(e) =>
                onUpdate(index, "pipelineStageId", e.target.value)
              }
            >
              <option value="" disabled>
                Selecione a coluna de destino
              </option>
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
>>>>>>> origin/main
      </div>
    </div>
  );
}
