'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from '@/components/ui/avatar';
import { PLATFORM_COLORS } from '@sos360/shared';
import type { KanbanLead } from './KanbanBoard';

interface KanbanCardProps {
    lead: KanbanLead;
    isDragging?: boolean;
    onClick?: () => void;
}

export function KanbanCard({ lead, isDragging, onClick }: KanbanCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: lead.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
    };

    const primaryPlatform = lead.socialProfiles?.[0]?.platform;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''}`}
            onClick={onClick}
        >
            <div className="kanban-card__content">
                <Avatar
                    src={lead.avatarUrl}
                    fallback={lead.fullName || lead.username || '?'}
                    size="sm"
                />
                <div className="kanban-card__info">
                    <span className="kanban-card__name">
                        {lead.fullName || lead.username || 'Sem nome'}
                    </span>
                    {lead.username && lead.fullName && (
                        <span className="kanban-card__username">@{lead.username}</span>
                    )}
                </div>
            </div>

            <div className="kanban-card__footer">
                {primaryPlatform && (
                    <span
                        className="kanban-card__platform"
                        style={{
                            backgroundColor: (PLATFORM_COLORS[primaryPlatform] || '#6366F1') + '20',
                            color: PLATFORM_COLORS[primaryPlatform] || '#6366F1',
                        }}
                    >
                        {primaryPlatform}
                    </span>
                )}
                {lead.assignedTo && (
                    <div className="kanban-card__assignee" title={lead.assignedTo.fullName}>
                        <Avatar
                            src={lead.assignedTo.avatarUrl}
                            fallback={lead.assignedTo.fullName}
                            size="xs"
                        />
                    </div>
                )}
            </div>

            <style jsx>{`
        .kanban-card {
          background: white;
          border-radius: 8px;
          padding: 0.75rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          cursor: grab;
          transition: box-shadow 0.2s, transform 0.2s;
        }

        .kanban-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .kanban-card--dragging {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          cursor: grabbing;
        }

        .kanban-card__content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .kanban-card__info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .kanban-card__name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kanban-card__username {
          font-size: 0.75rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kanban-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 0.5rem;
        }

        .kanban-card__platform {
          font-size: 0.625rem;
          font-weight: 500;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          text-transform: capitalize;
        }

        .kanban-card__assignee {
          display: flex;
          align-items: center;
        }
      `}</style>
        </div>
    );
}
