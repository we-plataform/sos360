'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, MessageSquare, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.getAnalyticsOverview() as any,
  });

  const { data: funnel } = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => api.getAnalyticsFunnel() as any,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const stats = [
    {
      name: 'Total de Leads',
      value: formatNumber(overview?.leads?.total || 0),
      change: `+${formatNumber(overview?.leads?.new || 0)} este mês`,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Conversas Ativas',
      value: formatNumber(overview?.conversations?.total || 0),
      change: `${formatPercent(overview?.conversations?.responseRate || 0)} taxa de resposta`,
      icon: MessageSquare,
      color: 'bg-green-500',
    },
    {
      name: 'Agendamentos',
      value: formatNumber(overview?.scheduled?.total || 0),
      change: `${overview?.scheduled?.completed || 0} concluídos`,
      icon: Calendar,
      color: 'bg-purple-500',
    },
    {
      name: 'Crescimento',
      value: formatPercent(overview?.leads?.growth || 0),
      change: 'vs. período anterior',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral da sua prospecção</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg ${stat.color} p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.change}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel and Platform Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnel?.stages?.map((stage: any, index: number) => (
                <div key={stage.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{stage.name}</span>
                    <span className="font-medium">{formatNumber(stage.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${stage.rate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(overview?.byPlatform || {}).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-indigo-600" />
                    <span className="capitalize">{platform}</span>
                  </div>
                  <span className="font-medium">{formatNumber(count as number)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
