'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { KanbanStage } from './KanbanBoard';
import { Zap, Play, Settings, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AutomationConfigModal } from './AutomationConfigModal';
import { RunAutomationModal } from './RunAutomationModal';

interface KanbanColumnProps {
  stage: KanbanStage;
  onLeadClick?: (leadId: string) => void;
}

export function KanbanColumn({ stage, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const [isAutomationModalOpen, setIsAutomationModalOpen] = React.useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = React.useState(false);
  const [automation, setAutomation] = React.useState<any>(stage.automations?.[0] || null);

  React.useEffect(() => {
    setAutomation(stage.automations?.[0] || null);
  }, [stage.automations]);

  const handleSaveAutomation = (newAutomation: any) => {
    setAutomation(newAutomation);
  };

  const handleRunClick = () => {
    if (!automation) return;
    setIsRunModalOpen(true);
  };

  const handleConfirmRun = async (config: { maxLeads: number; interval: string }) => {
    try {
      const result = await api.triggerAutomation(automation.id, config);

      // Show detailed success message
      toast.success(
        `Automação criada com ${(result as any)?.data?.message || 'sucesso'}! A extensão SOS 360 irá processar automaticamente. Certifique-se de que está logado na extensão.`,
        {
          duration: 8000,
          description: 'A extensão verifica novos jobs a cada 12 segundos. Mantenha o navegador aberto.'
        }
      );

      // Try to trigger immediate poll via extension (if extension ID is known)
      // This uses a fallback approach - posting to window for content script to relay
      try {
        const jobId = (result as any)?.jobId || (result as any)?.data?.jobId;
        console.log('Dispatching trigger event for job:', jobId);

        window.postMessage({
          type: 'SOS360_TRIGGER_AUTOMATION',
          jobId: jobId
        }, '*');
      } catch (e) {
        // Silent fail - extension will pick up via polling
        console.error('Error dispatching trigger event:', e);
      }

    } catch (error) {
      console.error('Failed to run automation', error);
      toast.error('Erro ao iniciar automação via API');
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column--over' : ''}`}
    >
      <div className={`kanban-column__header ${automation ? 'kanban-column__header--automated' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            {stage.name}
            <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {stage.leads.length}
            </span>
          </h3>
          <div className="flex items-center gap-1">
            {automation && (
              <button
                onClick={handleRunClick}
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white"
                title="Run Automation"
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            )}
            <button
              className="kanban-column__settings-btn"
              onClick={() => setIsAutomationModalOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="kanban-column__automation-bar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
              <Zap className={`h-3 w-3 ${automation ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
              <span>Automation</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs text-gray-500 cursor-pointer hover:text-gray-800"
                onClick={() => setIsAutomationModalOpen(true)}
              >
                {automation ? 'Edit' : 'Config'}
              </span>
              <Info className="h-3 w-3 text-gray-400" />
            </div>
          </div>

          {automation && automation.enabled && (
            <div className="flex gap-1">
              <button
                className="p-1 hover:bg-white/20 rounded transition-colors text-white"
                onClick={handleRunClick}
                title="Run Now"
              >
                <Play className="h-3 w-3 fill-white" />
              </button>
            </div>
          )}
        </div>
      </div>

      <SortableContext
        items={stage.leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="kanban-column__content">
          {stage.leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick?.(lead.id)}
            />
          ))}
        </div>
      </SortableContext>

      <AutomationConfigModal
        isOpen={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
        stageId={stage.id}
        stageName={stage.title}
        existingAutomation={automation}
        onSave={handleSaveAutomation}
      />

      {automation && (
        <RunAutomationModal
          isOpen={isRunModalOpen}
          onClose={() => setIsRunModalOpen(false)}
          onRun={handleConfirmRun}
          stage={stage}
          automationName={automation.name}
          actions={automation.actions || []}
        />
      )}

      <style jsx>{`
        .kanban-column {
          flex: 0 0 300px;
          background: #f8fafc;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          max-height: 100%;
          transition: background-color 0.2s;
          border: 1px solid #e2e8f0;
        }

        .kanban-column--over {
          background: #e0f2fe;
          border-color: #3b82f6;
        }

        .kanban-column__header {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
          background: white;
          border-radius: 12px 12px 0 0;
        }
        
        .kanban-column__header--automated {
            background: linear-gradient(to bottom, #fff, #fefce8);
        }

        .kanban-column__indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .kanban-column__title {
          flex: 1;
          font-size: 0.875rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .kanban-column__count {
          background: #e2e8f0;
          color: #64748b;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .kanban-column__settings-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: #94a3b8;
            margin-left: 4px;
        }
        
        .kanban-column__settings-btn:hover {
            color: #475569;
        }

        .kanban-column__automation-bar {
            background: rgba(0,0,0,0.03);
            border-radius: 6px;
            padding: 8px;
            margin-top: 4px;
        }
        
        .kanban-column__run-btn {
            width: 100%;
            margin-top: 8px;
            background: #ec4899;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 0.75rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .kanban-column__run-btn:hover {
            background: #db2777;
        }

        .kanban-column__content {
          flex: 1;
          padding: 0.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
