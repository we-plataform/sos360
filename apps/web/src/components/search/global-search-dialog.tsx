'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Kanban, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Lead {
  id: string;
  fullName?: string;
  username?: string;
  email?: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages?: { id: string }[];
}

interface Post {
  id: string;
  content?: string;
  authorUsername?: string;
}

interface SearchResult {
  type: 'lead' | 'pipeline' | 'post';
  id: string;
  title: string;
  subtitle?: string;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const searchAll = async () => {
      setIsLoading(true);
      try {
        const [leadsResponse, pipelinesResponse, postsResponse] = await Promise.all([
          api.getLeads({ search: debouncedQuery, limit: 5 }).catch(() => ({ leads: [] })),
          api.getPipelines().catch(() => []),
          api.getPosts({ search: debouncedQuery, limit: 5 }).catch(() => ({ posts: [] })),
        ]);

        const searchResults: SearchResult[] = [];

        // Process leads
        const leads = (leadsResponse as { leads?: Lead[] })?.leads || [];
        leads.forEach((lead: Lead) => {
          searchResults.push({
            type: 'lead',
            id: lead.id,
            title: lead.fullName || lead.username || 'Lead sem nome',
            subtitle: lead.email || lead.username,
          });
        });

        // Process pipelines (filter client-side since API doesn't support search)
        const pipelines = (pipelinesResponse as Pipeline[]) || [];
        const filteredPipelines = pipelines.filter((p: Pipeline) =>
          p.name.toLowerCase().includes(debouncedQuery.toLowerCase())
        );
        filteredPipelines.slice(0, 5).forEach((pipeline: Pipeline) => {
          searchResults.push({
            type: 'pipeline',
            id: pipeline.id,
            title: pipeline.name,
            subtitle: `${pipeline.stages?.length || 0} etapas`,
          });
        });

        // Process posts
        const posts = (postsResponse as { posts?: Post[] })?.posts || [];
        posts.forEach((post: Post) => {
          searchResults.push({
            type: 'post',
            id: post.id,
            title: post.content?.substring(0, 60) + (post.content && post.content.length > 60 ? '...' : '') || 'Post',
            subtitle: post.authorUsername ? `@${post.authorUsername}` : undefined,
          });
        });

        setResults(searchResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchAll();
  }, [debouncedQuery]);

  const navigateToResult = useCallback((result: SearchResult) => {
    onOpenChange(false);
    switch (result.type) {
      case 'lead':
        router.push(`/dashboard/leads/${result.id}/profile`);
        break;
      case 'pipeline':
        router.push(`/dashboard/leads?pipeline=${result.id}`);
        break;
      case 'post':
        router.push(`/dashboard/posts/${result.id}`);
        break;
    }
  }, [router, onOpenChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [results, selectedIndex, navigateToResult, onOpenChange]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const selectedElement = container.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return <User className="h-4 w-4" />;
      case 'pipeline':
        return <Kanban className="h-4 w-4" />;
      case 'post':
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return 'Leads';
      case 'pipeline':
        return 'Pipelines';
      case 'post':
        return 'Posts';
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result, index) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push({ ...result, globalIndex: index });
    return acc;
  }, {} as Record<string, (SearchResult & { globalIndex: number })[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 p-0 sm:max-w-xl">
        <div className="flex items-center border-b px-3" onKeyDown={handleKeyDown}>
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar leads, pipelines, posts..."
            className="flex h-12 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ESC
          </kbd>
        </div>

        <div ref={resultsRef} className="max-h-[300px] overflow-y-auto">
          {!query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Digite para buscar...
            </div>
          )}

          {query.trim() && !isLoading && results.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          )}

          {Object.entries(groupedResults).map(([type, items]) => (
            <div key={type}>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                {getTypeLabel(type as SearchResult['type'])}
              </div>
              {items.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent',
                    selectedIndex === result.globalIndex && 'bg-accent'
                  )}
                  onClick={() => navigateToResult(result)}
                  onMouseEnter={() => setSelectedIndex(result.globalIndex)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div className="truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
