'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';

export default function AutomationsPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
          <p className="text-gray-600">Configure fluxos automáticos para seus leads</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Example automation cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Boas-vindas Instagram
              </CardTitle>
              <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                Ativo
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-600">
              Envia mensagem de boas-vindas automaticamente para novos leads do Instagram
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">500 execuções</span>
              <span className="text-green-600">98% sucesso</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Follow-up 3 dias
              </CardTitle>
              <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                Ativo
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-600">
              Envia follow-up para leads que não responderam em 3 dias
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">150 execuções</span>
              <span className="text-green-600">95% sucesso</span>
            </div>
          </CardContent>
        </Card>

        {/* Empty state for new automation */}
        <Card className="flex flex-col items-center justify-center border-2 border-dashed p-8">
          <Zap className="mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-center text-gray-500">
            Crie uma nova automação para<br />
            otimizar seu processo de prospecção
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Nova Automação
          </Button>
        </Card>
      </div>
    </div>
  );
}
