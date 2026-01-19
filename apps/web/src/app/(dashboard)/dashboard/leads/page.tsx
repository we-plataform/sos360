'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, LayoutGrid, List, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { KanbanBoard, KanbanPipeline, StageManager } from '@/components/kanban';
import { LeadDetailModal } from '@/components/leads';
import { api } from '@/lib/api';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { socket } from '@/lib/socket';
import { PLATFORM_COLORS, STATUS_COLORS } from '@sos360/shared';

type ViewMode = 'list' | 'kanban';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);

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
    enabled: !!selectedPipelineId && viewMode === 'kanban',
  });

  // Fetch leads (for list view)
  const { data: leadsData, isLoading: isLeadsLoading } = useQuery({
    queryKey: ['leads', { search, platform, status }],
    queryFn: () => api.getLeads({ search, platform, status, limit: 50 }) as any,
    enabled: viewMode === 'list',
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

  const leads = leadsData || [];
  const isLoading = viewMode === 'list' ? isLeadsLoading : isPipelineLoading;
  const currentPipeline = pipelines.find((p: any) => p.id === selectedPipelineId);

  // Check if there are leads not in pipeline
  const hasUnmigratedLeads = pipelineData?.stages?.every((s: any) => s.leads.length === 0) &&
    (leadsData?.length > 0 || leadsData?.pagination?.total > 0);

  const handleMoveLead = (leadId: string, stageId: string, position: number) => {
    moveLeadMutation.mutate({ leadId, stageId, position });
  };

  const handleLeadClick = (leadId: string) => {
    setSelectedLeadId(leadId);
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
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-white p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${viewMode === 'kanban'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${viewMode === 'list'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
          </div>

          {/* Pipeline Selector */}
          {viewMode === 'kanban' && pipelines.length > 0 && (
            <>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={selectedPipelineId || ''}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
              >
                {pipelines.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
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

      {/* Migration Banner */}
      {viewMode === 'kanban' && hasUnmigratedLeads && (
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
      )}

      {/* Filters (List view only) */}
      {viewMode === 'list' && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nome, username ou email..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="">Todas as plataformas</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="new">Novo</option>
              <option value="contacted">Contatado</option>
              <option value="responded">Respondeu</option>
              <option value="qualified">Qualificado</option>
              <option value="scheduled">Agendado</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
        </Card>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : viewMode === 'kanban' ? (
        pipelineData ? (
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
      ) : leads.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center">
          <p className="text-gray-500">Nenhum lead encontrado</p>
          <Button variant="outline" className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Importar Leads
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map((lead: any) => (
            <Card
              key={lead.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleLeadClick(lead.id)}
            >
              <div className="flex items-center gap-4">
                <Avatar src={lead.avatarUrl} fallback={lead.fullName || lead.username} size="lg" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">
                      {lead.fullName || lead.username}
                    </h3>
                    {lead.verified && (
                      <Badge variant="secondary" className="text-xs">Verificado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    @{lead.username} • {lead.email || 'Sem email'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {/* Social Profiles */}
                    {lead.socialProfiles?.length > 0 ? (
                      lead.socialProfiles.map((profile: any) => (
                        <span
                          key={profile.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: (PLATFORM_COLORS[profile.platform] || '#6366F1') + '20',
                            color: PLATFORM_COLORS[profile.platform] || '#6366F1'
                          }}
                        >
                          {profile.platform}
                        </span>
                      ))
                    ) : lead.platform ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: (PLATFORM_COLORS[lead.platform] || '#6366F1') + '20',
                          color: PLATFORM_COLORS[lead.platform] || '#6366F1'
                        }}
                      >
                        {lead.platform}
                      </span>
                    ) : null}

                    {/* Status Badge */}
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: (STATUS_COLORS[lead.status] || '#6366F1') + '20',
                        color: STATUS_COLORS[lead.status] || '#6366F1'
                      }}
                    >
                      {lead.status}
                    </span>

                    {/* Tags */}
                    {lead.tags?.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: tag.color + '20',
                          color: tag.color
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-medium">{formatNumber(lead.followersCount || 0)}</span>
                    <span className="text-gray-500">seguidores</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Score: {lead.score}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatRelativeTime(lead.createdAt)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
