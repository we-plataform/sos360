'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KanbanBoard, KanbanPipeline, StageManager } from '@/components/kanban';
import { LeadDetailModal, CreatePipelineDialog } from '@/components/leads';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);

  // Fetch pipelines
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.getPipelines() as any,
  });

  const pipelines = pipelinesData || [];

  // Set default pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p: any) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Fetch pipeline with leads
  const { data: pipelineData, isLoading: isPipelineLoading } = useQuery({
    queryKey: ['pipeline', selectedPipelineId],
    queryFn: () => api.getPipeline(selectedPipelineId!) as any,
    enabled: !!selectedPipelineId,
  });

  // Move lead mutation
  const moveLeadMutation = useMutation({
    mutationFn: ({ leadId, stageId, position }: { leadId: string; stageId: string; position: number }) =>
      api.moveLead(selectedPipelineId!, leadId, stageId, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', selectedPipelineId] });
    },
  });

  // Create default pipeline if none exists
  const createPipelineMutation = useMutation({
    mutationFn: () => api.createPipeline({ name: 'Pipeline Principal' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
  });

  // Migrate leads mutation
  const migrateMutation = useMutation({
    mutationFn: () => api.migratePipeline(selectedPipelineId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', selectedPipelineId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  useEffect(() => {
    if (pipelinesData && pipelines.length === 0) {
      createPipelineMutation.mutate();
    }
  }, [pipelinesData]);

  // Socket listeners
  useEffect(() => {
    function onLeadChange() {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline', selectedPipelineId] });
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.on('lead:created', onLeadChange);
    socket.on('lead:updated', onLeadChange);
    socket.on('lead:deleted', onLeadChange);
    socket.on('lead:moved', onLeadChange);

    return () => {
      socket.off('lead:created', onLeadChange);
      socket.off('lead:updated', onLeadChange);
      socket.off('lead:deleted', onLeadChange);
      socket.off('lead:moved', onLeadChange);
    };
  }, [queryClient, selectedPipelineId]);

  const isLoading = isPipelineLoading;
  const currentPipeline = pipelines.find((p: any) => p.id === selectedPipelineId);

  // Check if there are leads not in pipeline - requires a separate check now since we removed leadsData
  // We can fetch a small count or similar if needed, but the original logic relied on leadsData.
  // The original logic:
  // const hasUnmigratedLeads = pipelineData?.stages?.every((s: any) => s.leads.length === 0) &&
  //   (leadsData?.length > 0 || leadsData?.pagination?.total > 0);

  // Since we removed leadsData (which fetched all leads), we might lose this "unmigrated leads" check capability 
  // without a specific query. However, purely removing the list view shouldn't necessarily break this if it's critical.
  // But given standard Kanban usage, if leads aren't in a stage, they aren't in the pipeline.
  // I will comment out the hasUnmigratedLeads logic for now as it depended on the list-view query.
  // If the user wants to keep this feature, we'd need a lightweight 'getUnmigratedLeadsCount' query.
  const hasUnmigratedLeads = false;

  const handleMoveLead = (leadId: string, stageId: string, position: number) => {
    moveLeadMutation.mutate({ leadId, stageId, position });
  };

  const handleLeadClick = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const handlePipelineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'create_new') {
      setIsCreatePipelineOpen(true);
    } else {
      setSelectedPipelineId(value);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Leads</h1>
          <p className="text-gray-600">
            Gerencie seus leads através do funil de vendas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline Selector */}
          {pipelines.length > 0 && (
            <>
              <select
                className="rounded-md border px-3 py-2 text-sm max-w-[200px]"
                value={selectedPipelineId || ''}
                onChange={handlePipelineChange}
              >
                {pipelines.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option disabled>──────────</option>
                <option value="create_new">+ Criar Novo Pipeline</option>
              </select>

              {/* Stage Manager Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStageManagerOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Migration Banner - Disabled for now as logic depended on list query */}
      {/* {hasUnmigratedLeads && (
        <Card className="mb-6 p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-amber-900">Leads não migrados</h3>
              <p className="text-sm text-amber-700">
                Existem leads que ainda não foram adicionados ao pipeline. Clique para migrá-los automaticamente.
              </p>
            </div>
            <Button
              onClick={() => migrateMutation.mutate()}
              disabled={migrateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {migrateMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Migrar Leads
            </Button>
          </div>
        </Card>
      )} */}

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : pipelineData ? (
        <KanbanBoard
          pipeline={pipelineData as KanbanPipeline}
          onMoveLead={handleMoveLead}
          onLeadClick={handleLeadClick}
        />
      ) : (
        <Card className="flex h-64 flex-col items-center justify-center">
          <p className="text-gray-500">Nenhum pipeline encontrado</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => createPipelineMutation.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar Pipeline
          </Button>
        </Card>
      )
      }

      {/* Lead Detail Modal */}
      <LeadDetailModal
        leadId={selectedLeadId || ''}
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />

      {/* Stage Manager Modal */}
      {currentPipeline && (
        <StageManager
          pipeline={currentPipeline}
          isOpen={isStageManagerOpen}
          onClose={() => setIsStageManagerOpen(false)}
        />
      )}

      {/* Create Pipeline Dialog */}
      <CreatePipelineDialog
        open={isCreatePipelineOpen}
        onOpenChange={setIsCreatePipelineOpen}
        onSuccess={(id) => setSelectedPipelineId(id)}
      />
    </div>
  );
}

