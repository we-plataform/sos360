'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, Target, Trash2, Edit, Users, MapPin, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface Audience {
    id: string;
    name: string;
    gender: string[];
    countries: string[];
    excludePrivate: boolean;
    excludeNoMessage: boolean;
    excludeNoPhoto: boolean;
    excludeCompanyPages: boolean;
    verifiedFilter: string;
    friendsMin: number | null;
    friendsMax: number | null;
    followersMin: number | null;
    followersMax: number | null;
    postsMin: number | null;
    postsMax: number | null;
    jobTitleInclude: string[];
    jobTitleExclude: string[];
    profileInfoInclude: string[];
    profileInfoExclude: string[];
    postContentInclude: string[];
    postContentExclude: string[];
    createdAt: string;
    updatedAt: string;
}

type SortField = 'name' | 'createdAt' | 'filters';
type SortDirection = 'asc' | 'desc';

export default function AudiencesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const { data: audiences = [], isLoading } = useQuery({
        queryKey: ['audiences'],
        queryFn: () => api.getAudiences() as Promise<Audience[]>,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteAudience(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['audiences'] });
            setDeleteId(null);
        },
    });

    const getFilterCount = (audience: Audience) => {
        let count = 0;
        if (audience.gender.length > 0) count++;
        if (audience.countries.length > 0) count++;
        if (audience.excludePrivate || audience.excludeNoMessage || audience.excludeNoPhoto || audience.excludeCompanyPages) count++;
        if (audience.verifiedFilter !== 'any') count++;
        if (audience.friendsMin || audience.friendsMax) count++;
        if (audience.followersMin || audience.followersMax) count++;
        if (audience.postsMin || audience.postsMax) count++;
        if (audience.jobTitleInclude.length > 0 || audience.jobTitleExclude.length > 0) count++;
        if (audience.profileInfoInclude.length > 0 || audience.profileInfoExclude.length > 0) count++;
        if (audience.postContentInclude.length > 0 || audience.postContentExclude.length > 0) count++;
        return count;
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredAndSortedAudiences = audiences
        .filter((audience) => audience.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
                case 'filters':
                    comparison = getFilterCount(a) - getFilterCount(b);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc'
            ? <ChevronUp className="h-4 w-4 ml-1" />
            : <ChevronDown className="h-4 w-4 ml-1" />;
    };

    return (
        <div>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audiências</h1>
                    <p className="text-gray-600">
                        Defina critérios de segmentação para mineração de leads
                    </p>
                </div>
                <Button onClick={() => router.push('/dashboard/audiences/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Audiência
                </Button>
            </div>

            {/* Search */}
            <Card className="mb-6 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder="Buscar por nome..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                </div>
            ) : filteredAndSortedAudiences.length === 0 ? (
                <Card className="flex h-64 flex-col items-center justify-center">
                    <Target className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">
                        {search ? 'Nenhuma audiência encontrada' : 'Nenhuma audiência criada ainda'}
                    </p>
                    {!search && (
                        <Button onClick={() => router.push('/dashboard/audiences/new')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar primeira audiência
                        </Button>
                    )}
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('name')}
                                            className="flex items-center font-semibold text-sm text-gray-600 hover:text-gray-900"
                                        >
                                            Nome
                                            <SortIcon field="name" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <span className="font-semibold text-sm text-gray-600">Gênero</span>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <span className="font-semibold text-sm text-gray-600">Países</span>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('filters')}
                                            className="flex items-center font-semibold text-sm text-gray-600 hover:text-gray-900"
                                        >
                                            Filtros
                                            <SortIcon field="filters" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <button
                                            onClick={() => handleSort('createdAt')}
                                            className="flex items-center font-semibold text-sm text-gray-600 hover:text-gray-900"
                                        >
                                            Criado em
                                            <SortIcon field="createdAt" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <span className="font-semibold text-sm text-gray-600">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedAudiences.map((audience) => (
                                    <tr
                                        key={audience.id}
                                        onClick={() => router.push(`/dashboard/audiences/${audience.id}`)}
                                        className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-900">{audience.name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {audience.gender.length > 0 ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm text-gray-600">
                                                        {audience.gender.map(g => g === 'male' ? 'Homem' : 'Mulher').join(', ')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Todos</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {audience.countries.length > 0 ? (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm text-gray-600">
                                                        {audience.countries.length} país{audience.countries.length > 1 ? 'es' : ''}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Todos</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="text-xs">
                                                <Filter className="h-3 w-3 mr-1" />
                                                {getFilterCount(audience)} filtro{getFilterCount(audience) !== 1 ? 's' : ''}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-500">
                                                {formatRelativeTime(audience.createdAt)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/audiences/${audience.id}`);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4 text-gray-500" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteId(audience.id);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500">
                        {filteredAndSortedAudiences.length} audiência{filteredAndSortedAudiences.length !== 1 ? 's' : ''} encontrada{filteredAndSortedAudiences.length !== 1 ? 's' : ''}
                    </div>
                </Card>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-2">Excluir Audiência</h3>
                        <p className="text-gray-600 mb-4">
                            Tem certeza que deseja excluir esta audiência? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteId(null)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(deleteId)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
