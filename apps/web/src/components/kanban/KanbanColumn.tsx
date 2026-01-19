'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { KanbanStage } from './KanbanBoard';

interface KanbanColumnProps {
    stage: KanbanStage;
    onLeadClick?: (leadId: string) => void;
}

export function KanbanColumn({ stage, onLeadClick }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`kanban-column ${isOver ? 'kanban-column--over' : ''}`}
        >
            <div className="kanban-column__header">
                <div
                    className="kanban-column__indicator"
                    style={{ backgroundColor: stage.color }}
                />
                <h3 className="kanban-column__title">{stage.name}</h3>
                <span className="kanban-column__count">{stage.leads.length}</span>
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

            <style jsx>{`
        .kanban-column {
          flex: 0 0 300px;
          background: #f8fafc;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          max-height: 100%;
          transition: background-color 0.2s;
        }

        .kanban-column--over {
          background: #e0f2fe;
        }

        .kanban-column__header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
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

        .kanban-column__content {
          flex: 1;
          padding: 0.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
      `}</style>
        </div>
    );
}
