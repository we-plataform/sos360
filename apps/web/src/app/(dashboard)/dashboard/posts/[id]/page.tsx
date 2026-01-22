'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Calendar,
  Clock,
  Link2,
  Unlink,
  Trash2,
  User,
  Instagram,
  Linkedin,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Post {
  id: string;
  platform: string;
  postUrl: string;
  content: string | null;
  imageUrls: string[];
  videoUrls: string[];
  linkedUrl: string | null;
  postType: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  viewsCount: number | null;
  authorUsername: string;
  authorFullName: string | null;
  authorAvatarUrl: string | null;
  authorProfileUrl: string | null;
  leadId: string | null;
  lead: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    profileUrl: string | null;
  } | null;
  postDate: string | null;
  importedAt: string;
  tags: { id: string; name: string; color: string }[];
}

interface Lead {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  platform: string | null;
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  linkedin: Linkedin,
};

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(searchParams.get('link') === 'true');
  const [leadSearch, setLeadSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', params.id],
    queryFn: () => api.getPost(params.id) as Promise<Post>,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', leadSearch],
    queryFn: () => api.getLeads({ search: leadSearch, limit: 10 }) as Promise<Lead[]>,
    enabled: showLinkModal,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePost(params.id),
    onSuccess: () => {
      toast.success('Post removido com sucesso');
      router.push('/dashboard/posts');
    },
    onError: () => {
      toast.error('Erro ao remover post');
    },
  });

  const linkMutation = useMutation({
    mutationFn: (leadId: string) => api.linkPostToLead(params.id, leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', params.id] });
      setShowLinkModal(false);
      toast.success('Post vinculado ao lead');
    },
    onError: () => {
      toast.error('Erro ao vincular post');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => api.unlinkPostFromLead(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', params.id] });
      toast.success('Post desvinculado do lead');
    },
    onError: () => {
      toast.error('Erro ao desvincular post');
    },
  });

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform] || FileText;
    return <Icon className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <FileText className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Post não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/posts')}>
          Voltar para Posts
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/posts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Detalhes do Post</h1>
            <p className="text-sm text-gray-500">
              Importado {formatRelativeTime(post.importedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Original
            </Button>
          </a>
          <Button
            variant="outline"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          {post.imageUrls && post.imageUrls.length > 0 && (
            <Card className="overflow-hidden">
              <div className="relative aspect-square bg-gray-100">
                <Image
                  src={post.imageUrls[currentImageIndex]}
                  alt="Post"
                  fill
                  className="object-contain"
                  unoptimized
                />
                {post.imageUrls.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev === 0 ? post.imageUrls.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev === post.imageUrls.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {post.imageUrls.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={cn(
                            'w-2 h-2 rounded-full transition-colors',
                            idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Content */}
          {post.content && (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Conteúdo</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
            </Card>
          )}

          {/* Videos */}
          {post.videoUrls && post.videoUrls.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Vídeos</h3>
              <div className="space-y-2">
                {post.videoUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Vídeo {idx + 1}
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Author Info */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Autor</h3>
            <div className="flex items-center gap-3">
              {post.authorAvatarUrl ? (
                <Image
                  src={post.authorAvatarUrl}
                  alt={post.authorUsername}
                  width={48}
                  height={48}
                  className="rounded-full"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-gray-900">@{post.authorUsername}</p>
                {post.authorFullName && (
                  <p className="text-sm text-gray-500">{post.authorFullName}</p>
                )}
              </div>
            </div>
            {post.authorProfileUrl && (
              <a
                href={post.authorProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Perfil
              </a>
            )}
          </Card>

          {/* Metrics */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Métricas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <Heart className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <p className="text-lg font-semibold">{formatNumber(post.likesCount)}</p>
                <p className="text-xs text-gray-500">Curtidas</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <MessageCircle className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-semibold">{formatNumber(post.commentsCount)}</p>
                <p className="text-xs text-gray-500">Comentários</p>
              </div>
              {post.sharesCount !== null && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Share2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-lg font-semibold">{formatNumber(post.sharesCount)}</p>
                  <p className="text-xs text-gray-500">Compartilhamentos</p>
                </div>
              )}
              {post.viewsCount !== null && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Eye className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                  <p className="text-lg font-semibold">{formatNumber(post.viewsCount)}</p>
                  <p className="text-xs text-gray-500">Visualizações</p>
                </div>
              )}
            </div>
          </Card>

          {/* Post Info */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informações</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <PlatformIcon platform={post.platform} />
                <span className="capitalize">{post.platform}</span>
                {post.postType && (
                  <Badge variant="secondary" className="ml-auto">
                    {post.postType}
                  </Badge>
                )}
              </div>
              {post.postDate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Publicado em {formatDate(post.postDate)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Importado {formatRelativeTime(post.importedAt)}</span>
              </div>
            </div>
          </Card>

          {/* Lead Link */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Lead Vinculado</h3>
            {post.lead ? (
              <div>
                <Link
                  href={`/dashboard/leads?id=${post.lead.id}`}
                  className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  {post.lead.avatarUrl ? (
                    <Image
                      src={post.lead.avatarUrl}
                      alt={post.lead.fullName || post.lead.username || 'Lead'}
                      width={40}
                      height={40}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {post.lead.fullName || post.lead.username}
                    </p>
                    {post.lead.username && post.lead.fullName && (
                      <p className="text-sm text-gray-500">@{post.lead.username}</p>
                    )}
                  </div>
                  <Link2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => unlinkMutation.mutate()}
                  disabled={unlinkMutation.isPending}
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  {unlinkMutation.isPending ? 'Desvinculando...' : 'Desvincular'}
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">
                  Este post não está vinculado a nenhum lead
                </p>
                <Button onClick={() => setShowLinkModal(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Vincular a Lead
                </Button>
              </div>
            )}
          </Card>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Link to Lead Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Vincular a Lead</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar leads..."
                className="pl-10"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {(leads as any)?.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  {leadSearch ? 'Nenhum lead encontrado' : 'Digite para buscar leads'}
                </p>
              ) : (
                (leads as any)?.map((lead: Lead) => (
                  <button
                    key={lead.id}
                    onClick={() => linkMutation.mutate(lead.id)}
                    disabled={linkMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    {lead.avatarUrl ? (
                      <Image
                        src={lead.avatarUrl}
                        alt={lead.fullName || lead.username || 'Lead'}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {lead.fullName || lead.username}
                      </p>
                      {lead.username && (
                        <p className="text-sm text-gray-500">@{lead.username}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowLinkModal(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Excluir Post</h3>
            <p className="text-gray-600 mb-4">
              Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
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
