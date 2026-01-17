'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.getAnalyticsOverview() as any,
  });

  const { data: funnel } = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => api.getAnalyticsFunnel() as any,
  });

  const { data: timeline } = useQuery({
    queryKey: ['analytics', 'timeline', { interval: 'day', metric: 'leads' }],
    queryFn: () => api.getAnalyticsTimeline({ interval: 'day', metric: 'leads' }) as any,
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">
          Período: {overview?.period?.start} a {overview?.period?.end}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total de Leads</p>
            <p className="text-3xl font-bold">{formatNumber(overview?.leads?.total || 0)}</p>
            <p className="text-sm text-green-600">
              +{formatNumber(overview?.leads?.new || 0)} novos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Taxa de Resposta</p>
            <p className="text-3xl font-bold">
              {formatPercent(overview?.conversations?.responseRate || 0)}
            </p>
            <p className="text-sm text-gray-500">
              {overview?.conversations?.total || 0} conversas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Crescimento</p>
            <p className="text-3xl font-bold text-green-600">
              {formatPercent(overview?.leads?.growth || 0)}
            </p>
            <p className="text-sm text-gray-500">vs. período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Conversão Total</p>
            <p className="text-3xl font-bold">
              {formatPercent(
                funnel?.conversionRates?.qualifiedToScheduled *
                  funnel?.conversionRates?.scheduledToClosed || 0
              )}
            </p>
            <p className="text-sm text-gray-500">qualificado → fechado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {funnel?.stages?.map((stage: any, index: number) => {
                const nextStage = funnel?.stages?.[index + 1];
                const conversionRate = nextStage
                  ? (nextStage.count / stage.count) * 100
                  : null;

                return (
                  <div key={stage.name}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{stage.name}</span>
                      <span>{formatNumber(stage.count)}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-gray-100">
                      <div
                        className="h-8 rounded-lg bg-indigo-600 transition-all"
                        style={{ width: `${stage.rate * 100}%` }}
                      />
                    </div>
                    {conversionRate !== null && (
                      <p className="mt-1 text-right text-xs text-gray-500">
                        {conversionRate.toFixed(1)}% conversão →
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <div className="flex h-full items-end gap-1">
                {timeline?.points?.slice(-30).map((point: any, i: number) => {
                  const maxValue = Math.max(
                    ...timeline.points.slice(-30).map((p: any) => p.value)
                  );
                  const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;

                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-indigo-600 transition-all hover:bg-indigo-700"
                      style={{ height: `${height}%` }}
                      title={`${point.date}: ${point.value} leads`}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(overview?.byStatus || {}).map(([status, count]) => {
                const total = Object.values(overview?.byStatus || {}).reduce(
                  (a: number, b: unknown) => a + (b as number),
                  0
                ) as number;
                const percent = total > 0 ? ((count as number) / total) * 100 : 0;

                return (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span>{formatNumber(count as number)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-indigo-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* By Platform */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(overview?.byPlatform || {}).map(([platform, count]) => {
                const total = Object.values(overview?.byPlatform || {}).reduce(
                  (a: number, b: unknown) => a + (b as number),
                  0
                ) as number;
                const percent = total > 0 ? ((count as number) / total) * 100 : 0;

                return (
                  <div key={platform}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{platform}</span>
                      <span>{formatNumber(count as number)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
