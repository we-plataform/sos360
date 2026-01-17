'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { PLATFORM_COLORS, STATUS_COLORS } from '@sos360/shared';

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { search, platform, status }],
    queryFn: () => api.getLeads({ search, platform, status, limit: 50 }) as any,
  });

  const leads = data || [];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600">
            {data?.pagination?.total || 0} leads no total
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Filters */}
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

      {/* Leads List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
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
            <Card key={lead.id} className="p-4 hover:shadow-md transition-shadow">
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
                  <div className="flex items-center gap-3 mt-1">
                    <span 
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ 
                        backgroundColor: PLATFORM_COLORS[lead.platform] + '20',
                        color: PLATFORM_COLORS[lead.platform]
                      }}
                    >
                      {lead.platform}
                    </span>
                    <span 
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ 
                        backgroundColor: STATUS_COLORS[lead.status] + '20',
                        color: STATUS_COLORS[lead.status]
                      }}
                    >
                      {lead.status}
                    </span>
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
    </div>
  );
}
