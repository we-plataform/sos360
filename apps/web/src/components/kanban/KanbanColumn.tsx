'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { KanbanStage } from './KanbanBoard';
import { Play, Settings, Info, DollarSign, Database, Edit2, MoreVertical, AlignLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AutomationConfigModal } from './AutomationConfigModal';
import { RunAutomationModal } from './RunAutomationModal';

interface KanbanColumnProps {
  stage: KanbanStage;
  index: number;
  onLeadClick?: (leadId: string) => void;
}

// Stage configuration based on index
const STAGE_CONFIGS = [
  { bg: 'bg-[#84CC63]', text: 'white', border: 'border-[#70BE51]', icon: Database }, // 01 - Qualified
  { bg: 'bg-[#F9D41F]', text: 'white', border: 'border-[#E6C21C]', icon: Edit2 }, // 02 - Connection Sent
  { bg: 'bg-[#A2D879]', text: 'white', border: 'border-[#8EC766]', icon: AlignLeft }, // 03 - Accepted
  { bg: 'bg-[#43B8D6]', text: 'white', border: 'border-[#3AA6C2]', icon: Edit2 }, // 04 - Message Sent
  { bg: 'bg-[#5ECBE5]', text: 'white', border: 'border-[#4DBBD4]', icon: Edit2 }  // 05 - Follow Up
];

export function KanbanColumn({ stage, index, onLeadClick }: KanbanColumnProps) {
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
      toast.success(
        `Automação criada com ${(result as any)?.data?.message || 'sucesso'}!`,
        {
          duration: 8000,
          description: 'A extensão irá processar automaticamente.'
        }
      );

      try {
        const jobId = (result as any)?.jobId || (result as any)?.data?.jobId;
        window.postMessage({
          type: 'SOS360_TRIGGER_AUTOMATION',
          jobId: jobId
        }, '*');
      } catch (e) {
        console.error('Error dispatching trigger event:', e);
      }

    } catch (error) {
      console.error('Failed to run automation', error);
      toast.error('Erro ao iniciar automação via API');
    }
  };

  // Get style config based on index or default
  const styleConfig = STAGE_CONFIGS[index % STAGE_CONFIGS.length];
  const StageIcon = styleConfig.icon;

  // Calculate total value
  const totalValue = stage.leads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
  const formattedIndex = (index + 1).toString().padStart(2, '0');

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column--over' : ''} ${index === 0 ? 'kanban-column--first' : 'kanban-column--middle'}`}
    >
      {/* Header Colored Top */}
      <div className={`kanban-column__header-top ${styleConfig.bg}`}>
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span className="opacity-90">{formattedIndex} - </span>
          {StageIcon && <StageIcon size={14} className="opacity-90" />}
          <span className="truncate">{stage.name}</span>
        </div>
      </div>

      {/* Header Metrics */}
      <div className="kanban-column__metrics">
        <div className="flex items-center gap-1">
          <span className="font-bold text-gray-700">{stage.leads.length}</span>
          <span className="text-gray-500 text-xs">Leads</span>
        </div>
        <div className="flex gap-2">
          <Settings size={14} className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => setIsAutomationModalOpen(true)} />
          <MoreVertical size={14} className="text-gray-400 cursor-pointer hover:text-gray-600" />
        </div>
      </div>
      <div className="kanban-column__value-row">
        <div className="flex items-center gap-1 text-pink-600 font-bold text-xs">
          <div className="bg-pink-600 text-white rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-[9px]">$</div>
          <span>${totalValue}</span>
        </div>
      </div>

      {/* Automation Bar */}
      <div className={`px-2 py-1.5 flex items-center justify-between text-xs font-medium transition-colors ${automation ? 'bg-[#666] text-white' : 'bg-[#9CA3AF] text-white'}`}>
        {automation ? (
          <>
            <span>Automation</span>
            <div className="flex items-center gap-1 cursor-pointer hover:text-gray-200" onClick={() => setIsAutomationModalOpen(true)}>
              <span>Edit</span>
              <Info size={12} />
            </div>
          </>
        ) : (
          <span className="w-full text-center">No Automation Defined</span>
        )}
      </div>

      {/* Action Button: Run Now OR Add Automation */}
      {automation && automation.enabled ? (
        <button
          onClick={handleRunClick}
          className="w-full bg-[#EC008C] hover:bg-[#D4007D] text-white py-1.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wide transition-colors"
        >
          <Play size={10} fill="currentColor" />
          Run Now
        </button>
      ) : (
        <button
          onClick={() => setIsAutomationModalOpen(true)}
          className="w-full bg-white hover:bg-gray-50 text-gray-500 py-1.5 flex items-center justify-center gap-1 font-medium text-xs border-b border-x border-gray-200"
        >
          <span className="text-lg leading-none mb-0.5">+</span>
          Add Automation
        </button>
      )}

      {/* Downward Arrow Indicator */}
      <div className={`kanban-column__header-indicator ${!automation ? 'kanban-column__header-indicator--no-auto' : ''}`}></div>

      {/* Content */}
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
        stageName={stage.name}
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
          flex: 0 0 280px;
          background: #EBF8FC; 
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          max-height: 100%;
          border: 1px solid #ddd;
          overflow: hidden;
        }

        .kanban-column--over {
          background: #e0f2fe;
          border-color: #3b82f6;
        }

        .kanban-column__header-top {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            /* Arrow pointing right */
            clip-path: polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%);
            /* If it's not the first column, we might want a notch on the left too, 
               but for now let's just make them point right. 
               To truly interlock, we'd need:
               clip-path: polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%);
               And padding-left to compensate. */
             
             /* Dynamic clip-path is safer inline or via class if index varies */
             min-height: 40px;
             display: flex;
             align-items: center;
        }
        
        /* Specific interlocking shape classes */
        .kanban-column--first .kanban-column__header-top {
             clip-path: polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%);
        }
        
        .kanban-column--middle .kanban-column__header-top {
             clip-path: polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%);
             padding-left: 20px; /* Compensate for left notch */
        }
        
        /* Downward Chevron Indicator container */
        .kanban-column__header-indicator {
            height: 12px;
            background: #EBF8FC; 
            position: relative;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            z-index: 10;
        }
        
        .kanban-column__header-indicator::after {
            content: '';
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid #666; /* Gray to match automation bar */
        }
        
        .kanban-column__header-indicator--no-auto::after {
            border-top-color: #9CA3AF;
        }

        .kanban-column__metrics {
            padding: 6px 10px 2px 10px;
            background: #EBF8FC;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .kanban-column__value-row {
            padding: 0 10px 8px 10px;
            background: #EBF8FC;
        }

        .kanban-column__content {
          flex: 1;
          padding: 8px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          /* Custom scrollbar */
        }
        
        .kanban-column__content::-webkit-scrollbar {
            width: 4px;
        }
        
        .kanban-column__content::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
