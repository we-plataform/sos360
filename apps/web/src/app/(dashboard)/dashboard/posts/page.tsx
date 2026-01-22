'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Link2,
  Unlink,
  ExternalLink,
  LayoutGrid,
  List,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Instagram,
  Linkedin,
  ChevronDown,
  ChevronUp,
  Filter,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  } | null;
  postDate: string | null;
  importedAt: string;
  tags: { id: string; name: string; color: string }[];
}

interface PostsResponse {
  data: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type ViewMode = 'grid' | 'list';
type SortField = 'importedAt' | 'postDate' | 'likesCount' | 'commentsCount';
type SortDirection = 'asc' | 'desc';

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  linkedin: Linkedin,
};

export default function PostsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<string>('all');
  const [hasLead, setHasLead] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('importedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['posts', { page, platform, hasLead, search, sortField, sortDirection }],
    queryFn: () =>
      api.getPosts({
        page,
        limit: viewMode === 'grid' ? 12 : 20,
        ...(platform !== 'all' && { platform }),
        ...(hasLead !== 'all' && { hasLead: hasLead === 'linked' }),
        ...(search && { search }),
        sort: sortField,
        order: sortDirection,
      }) as Promise<PostsResponse>,
  });

  const posts = (postsData as any) || [];
  const pagination = (postsData as any)?.pagination;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setDeleteId(null);
      toast.success('Post removido com sucesso');
    },
    onError: () => {
      toast.error('Erro ao remover post');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (postId: string) => api.unlinkPostFromLead(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post desvinculado do lead');
    },
    onError: () => {
      toast.error('Erro ao desvincular post');
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Posts</h1>
          <p className="text-gray-600">
            Posts importados de redes sociais
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por conteúdo ou autor..."
              className="pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select value={platform} onValueChange={(v: string) => { setPlatform(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>

          <Select value={hasLead} onValueChange={(v: string) => { setHasLead(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vinculado a Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="linked">Vinculados</SelectItem>
              <SelectItem value="unlinked">Sem vínculo</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
              )}
              title="Visualização em grade"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
              )}
              title="Visualização em lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {search || platform !== 'all' || hasLead !== 'all'
              ? 'Nenhum post encontrado'
              : 'Nenhum post importado ainda'}
          </p>
          <p className="text-sm text-gray-400 text-center max-w-md">
            Use a extensão do Chrome para salvar posts do Instagram ou LinkedIn
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post: Post) => (
            <Card
              key={post.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/posts/${post.id}`)}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 relative">
                {post.imageUrls && post.imageUrls.length > 0 ? (
                  <Image
                    src={post.imageUrls[0]}
                    alt="Post"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                {/* Platform badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant="secondary"
                    className="bg-white/90 text-gray-700"
                  >
                    <PlatformIcon platform={post.platform} />
                    <span className="ml-1 capitalize">{post.platform}</span>
                  </Badge>
                </div>
                {/* Lead link indicator */}
                {post.lead && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500 text-white">
                      <Link2 className="h-3 w-3" />
                    </Badge>
                  </div>
                )}
                {/* Multiple images indicator */}
                {post.imageUrls && post.imageUrls.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    +{post.imageUrls.length - 1}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3">
                {/* Author */}
                <div className="flex items-center gap-2 mb-2">
                  {post.authorAvatarUrl ? (
                    <Image
                      src={post.authorAvatarUrl}
                      alt={post.authorUsername}
                      width={24}
                      height={24}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-3 w-3 text-gray-500" />
                    </div>
                  )}
                  <span className="text-sm font-medium truncate">
                    @{post.authorUsername}
                  </span>
                </div>

                {/* Caption preview */}
                {post.content && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {post.content}
                  </p>
                )}

                {/* Metrics */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {post.likesCount !== null && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(post.likesCount)}
                    </span>
                  )}
                  {post.commentsCount !== null && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(post.commentsCount)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-4 text-left">
                    <span className="font-semibold text-sm text-gray-600">Post</span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="font-semibold text-sm text-gray-600">Autor</span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="font-semibold text-sm text-gray-600">Lead Vinculado</span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('likesCount')}
                      className="flex items-center font-semibold text-sm text-gray-600 hover:text-gray-900"
                    >
                      Engajamento
                      <SortIcon field="likesCount" />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('importedAt')}
                      className="flex items-center font-semibold text-sm text-gray-600 hover:text-gray-900"
                    >
                      Importado em
                      <SortIcon field="importedAt" />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <span className="font-semibold text-sm text-gray-600">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post: Post) => (
                  <tr
                    key={post.id}
                    onClick={() => router.push(`/dashboard/posts/${post.id}`)}
                    className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                          {post.imageUrls && post.imageUrls.length > 0 ? (
                            <Image
                              src={post.imageUrls[0]}
                              alt="Post"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="h-6 w-6 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs shrink-0">
                              <PlatformIcon platform={post.platform} />
                              <span className="ml-1 capitalize">{post.platform}</span>
                            </Badge>
                            {post.postType && (
                              <Badge variant="secondary" className="text-xs">
                                {post.postType}
                              </Badge>
                            )}
                          </div>
                          {post.content && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {post.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {post.authorAvatarUrl ? (
                          <Image
                            src={post.authorAvatarUrl}
                            alt={post.authorUsername}
                            width={32}
                            height={32}
                            className="rounded-full"
                            unoptimized
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">@{post.authorUsername}</p>
                          {post.authorFullName && (
                            <p className="text-xs text-gray-500">{post.authorFullName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {post.lead ? (
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{post.lead.fullName || post.lead.username}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {post.likesCount !== null && (
                          <span className="flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            {formatNumber(post.likesCount)}
                          </span>
                        )}
                        {post.commentsCount !== null && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {formatNumber(post.commentsCount)}
                          </span>
                        )}
                        {post.sharesCount !== null && (
                          <span className="flex items-center gap-1">
                            <Share2 className="h-4 w-4" />
                            {formatNumber(post.sharesCount)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(post.importedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Abrir post original"
                        >
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                        {post.lead ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              unlinkMutation.mutate(post.id);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Desvincular do lead"
                          >
                            <Unlink className="h-4 w-4 text-gray-500" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/posts/${post.id}?link=true`);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Vincular a lead"
                          >
                            <Link2 className="h-4 w-4 text-gray-500" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(post.id);
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
          <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 flex items-center justify-between">
            <span>
              {pagination?.total || posts.length} post{(pagination?.total || posts.length) !== 1 ? 's' : ''} encontrado{(pagination?.total || posts.length) !== 1 ? 's' : ''}
            </span>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {page} de {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Pagination for grid view */}
      {viewMode === 'grid' && pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-500">
            Página {page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page >= pagination.totalPages}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Excluir Post</h3>
            <p className="text-gray-600 mb-4">
              Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
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
