'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail, Phone, Globe, MapPin, ExternalLink, User, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { PLATFORM_COLORS, STATUS_COLORS } from '@sos360/shared';

interface LeadDetailModalProps {
    leadId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function LeadDetailModal({ leadId, isOpen, onClose }: LeadDetailModalProps) {
    const queryClient = useQueryClient();

    const { data: lead, isLoading } = useQuery({
        queryKey: ['lead', leadId],
        queryFn: () => api.getLead(leadId) as any,
        enabled: isOpen && !!leadId,
    });

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const deleteLeadMutation = useMutation({
        mutationFn: () => api.deleteLead(leadId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline'] });
            onClose();
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
                {showDeleteConfirm ? (
                    <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-gray-900">Excluir Lead</h3>
                        <p className="mb-6 text-sm text-gray-500">
                            Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex justify-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => deleteLeadMutation.mutate()}
                                disabled={deleteLeadMutation.isPending}
                            >
                                {deleteLeadMutation.isPending ? 'Excluindo...' : 'Sim, excluir'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-20">
                            <h2 className="text-lg font-semibold text-gray-900">Detalhes do Lead</h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    title="Excluir Lead"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                            </div>
                        ) : lead ? (
                            <div className="p-6 space-y-6">
                                {/* Profile Header */}
                                <div className="flex items-start gap-4">
                                    <Avatar
                                        src={lead.avatarUrl}
                                        fallback={lead.fullName || lead.username}
                                        size="lg"
                                        className="h-20 w-20"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-semibold text-gray-900">
                                                {lead.fullName || lead.username || 'Sem nome'}
                                            </h3>
                                            {lead.verified && (
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                    Verificado
                                                </span>
                                            )}
                                        </div>
                                        {lead.username && (
                                            <p className="text-gray-500">@{lead.username}</p>
                                        )}
                                        {lead.bio && (
                                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{lead.bio}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-indigo-600">{lead.score}</div>
                                        <div className="text-xs text-gray-500">Score</div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="p-4 text-center">
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatNumber(lead.followersCount || 0)}
                                        </div>
                                        <div className="text-sm text-gray-500">Seguidores</div>
                                    </Card>
                                    <Card className="p-4 text-center">
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatNumber(lead.followingCount || 0)}
                                        </div>
                                        <div className="text-sm text-gray-500">Seguindo</div>
                                    </Card>
                                    <Card className="p-4 text-center">
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatNumber(lead.postsCount || 0)}
                                        </div>
                                        <div className="text-sm text-gray-500">Posts</div>
                                    </Card>
                                </div>

                                {/* Social Profiles */}
                                {lead.socialProfiles?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Redes Sociais</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {lead.socialProfiles.map((profile: any) => (
                                                <a
                                                    key={profile.id}
                                                    href={profile.profileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
                                                    style={{
                                                        backgroundColor: (PLATFORM_COLORS[profile.platform] || '#6366F1') + '20',
                                                        color: PLATFORM_COLORS[profile.platform] || '#6366F1',
                                                    }}
                                                >
                                                    {profile.platform}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Contact Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    {lead.email && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                            <Mail className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Email</div>
                                                <a href={`mailto:${lead.email}`} className="text-sm text-indigo-600 hover:underline">
                                                    {lead.email}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {lead.phone && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                            <Phone className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Telefone</div>
                                                <a href={`tel:${lead.phone}`} className="text-sm text-indigo-600 hover:underline">
                                                    {lead.phone}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {lead.website && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                            <Globe className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Website</div>
                                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate block max-w-[200px]">
                                                    {lead.website}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {lead.location && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                            <MapPin className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Localização</div>
                                                <div className="text-sm text-gray-900">{lead.location}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Status & Assigned */}
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Status</div>
                                        <span
                                            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                                            style={{
                                                backgroundColor: (STATUS_COLORS[lead.status] || '#6366F1') + '20',
                                                color: STATUS_COLORS[lead.status] || '#6366F1',
                                            }}
                                        >
                                            {lead.status}
                                        </span>
                                    </div>
                                    {lead.assignedTo && (
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Responsável</div>
                                            <div className="flex items-center gap-2">
                                                <Avatar
                                                    src={lead.assignedTo.avatarUrl}
                                                    fallback={lead.assignedTo.fullName}
                                                    size="sm"
                                                />
                                                <span className="text-sm text-gray-900">{lead.assignedTo.fullName}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tags */}
                                {lead.tags?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {lead.tags.map((tag: any) => (
                                                <span
                                                    key={tag.id}
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: tag.color + '20',
                                                        color: tag.color,
                                                    }}
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {lead.notes && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Notas</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                                            {lead.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Timeline */}
                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <span>Criado {formatRelativeTime(lead.createdAt)}</span>
                                        {lead.lastInteractionAt && (
                                            <span>Última interação {formatRelativeTime(lead.lastInteractionAt)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-gray-500">
                                Lead não encontrado
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
