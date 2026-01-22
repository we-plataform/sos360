'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [inviteEmail, setInviteEmail] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers() as any,
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      await api.inviteUser(inviteEmail);
      setInviteEmail('');
      // Refresh users list
    } catch (error) {
      console.error('Failed to invite user:', error);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600">Gerencie seu workspace e equipe</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar fallback={user?.fullName} size="lg" />
              <div>
                <p className="font-medium">{user?.fullName}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize">{currentWorkspace?.role}</p>
              </div>
            </div>
            <Button variant="outline">Editar Perfil</Button>
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader>
            <CardTitle>Equipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button onClick={handleInvite}>Convidar</Button>
            </div>

            <div className="divide-y">
              {users?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Avatar fallback={member.fullName} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{member.fullName}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Workspace</label>
              <Input defaultValue="Meu Workspace" className="mt-1" />
            </div>
            <Button>Salvar Alterações</Button>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500">
              Conecte ferramentas externas para expandir suas capacidades
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">Zapier</span>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">Google Calendar</span>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">HubSpot CRM</span>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
