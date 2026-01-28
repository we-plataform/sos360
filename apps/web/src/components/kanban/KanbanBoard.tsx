"use client";

import React from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

export interface KanbanLead {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  position: number;
  email: string | null;
  phone: string | null;
  followersCount: number | null;
  connectionCount: number | null;
  status: string;
  score: number;
  verified: boolean;
  platform: string | null;
  dealValue?: number; // Added for UI design
  assignedTo?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  } | null;
  socialProfiles?: {
    platform: string;
    profileUrl: string | null;
    followersCount: number | null;
  }[];
}

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  order: number;
  leads: KanbanLead[];
  automations?: any[]; // Using any for now to avoid extensive type definitions here, or define it properly
}

export interface KanbanPipeline {
  id: string;
  name: string;
  stages: KanbanStage[];
}

interface KanbanBoardProps {
  pipeline: KanbanPipeline;
  onMoveLead: (leadId: string, stageId: string, position: number) => void;
  onLeadClick?: (leadId: string) => void;
  onUpdateLead?: (leadId: string, data: Record<string, any>) => void;
}

export function KanbanBoard({
  pipeline,
  onMoveLead,
  onLeadClick,
  onUpdateLead,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [stages, setStages] = React.useState<KanbanStage[]>(pipeline.stages);

  // Sync local state when prop changes - critical for React Query updates
  React.useEffect(() => {
    console.log(
      "[KANBAN-DEBUG] Prop pipeline.stages changed. Syncing local state.",
      {
        pipelineId: pipeline.id,
        totalLeads: pipeline.stages.reduce((acc, s) => acc + s.leads.length, 0),
      },
    );
    setStages(pipeline.stages);
  }, [pipeline.stages, pipeline.id]); // Added pipeline.id to the dependency array

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findStage = (leadId: string): KanbanStage | undefined => {
    return stages.find((stage) =>
      stage.leads.some((lead) => lead.id === leadId),
    );
  };

  const findLead = (leadId: string): KanbanLead | undefined => {
    for (const stage of stages) {
      const lead = stage.leads.find((l) => l.id === leadId);
      if (lead) return lead;
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeStage = findStage(activeId);
    let overStage = findStage(overId);

    // If overId is a stage (dropped on column)
    if (!overStage) {
      overStage = stages.find((s) => s.id === overId);
    }

    if (!activeStage || !overStage) return;
    if (activeStage.id === overStage.id) return;

    setStages((prev) => {
      const activeLeadIndex = activeStage.leads.findIndex(
        (l) => l.id === activeId,
      );
      const activeLead = activeStage.leads[activeLeadIndex];

      return prev.map((stage) => {
        if (stage.id === activeStage.id) {
          return {
            ...stage,
            leads: stage.leads.filter((l) => l.id !== activeId),
          };
        }
        if (stage.id === overStage!.id) {
          const overLeadIndex = stage.leads.findIndex((l) => l.id === overId);
          const insertIndex =
            overLeadIndex >= 0 ? overLeadIndex : stage.leads.length;
          const newLeads = [...stage.leads];
          newLeads.splice(insertIndex, 0, activeLead);
          return {
            ...stage,
            leads: newLeads,
          };
        }
        return stage;
      });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const overStage = findStage(activeId);
    if (!overStage) return;

    // Calculate new position
    const leadIndex = overStage.leads.findIndex((l) => l.id === activeId);
    let position: number;

    if (leadIndex === 0) {
      position = overStage.leads[0]?.position
        ? overStage.leads[0].position / 2
        : 1000;
    } else if (leadIndex === overStage.leads.length - 1) {
      const lastPos =
        overStage.leads[overStage.leads.length - 1]?.position || 0;
      position = lastPos + 1000;
    } else {
      const prevPos = overStage.leads[leadIndex - 1]?.position || 0;
      const nextPos =
        overStage.leads[leadIndex + 1]?.position || prevPos + 2000;
      position = (prevPos + nextPos) / 2;
    }

    onMoveLead(activeId, overStage.id, position);
  };

  const activeLead = activeId ? findLead(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {stages.map((stage, index) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            index={index}
            onLeadClick={onLeadClick}
            onUpdateLead={onUpdateLead}
            pipelineId={pipeline.id}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <KanbanCard
            lead={activeLead}
            isDragging
            onUpdateStatus={(status) =>
              onUpdateLead?.(activeLead.id, { status })
            }
          />
        ) : null}
      </DragOverlay>

      <style jsx>{`
        .kanban-board {
          display: flex;
          gap: 2px;
          overflow-x: auto;
          min-height: calc(100vh - 200px);
        }
      `}</style>
    </DndContext>
  );
}
