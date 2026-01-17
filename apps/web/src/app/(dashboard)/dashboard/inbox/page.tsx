'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations() as any,
  });

  const { data: selectedConversation } = useQuery({
    queryKey: ['conversation', selectedId],
    queryFn: () => api.getConversation(selectedId!) as any,
    enabled: !!selectedId,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.sendMessage(selectedId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessage('');
    },
  });

  const handleSend = () => {
    if (!message.trim() || !selectedId) return;
    sendMutation.mutate(message);
  };

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-80 border-r bg-white">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <p className="text-sm text-gray-500">
            {conversations?.length || 0} conversas
          </p>
        </div>

        <div className="overflow-y-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : conversations?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhuma conversa ainda
            </div>
          ) : (
            conversations?.map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  'w-full border-b p-4 text-left transition-colors hover:bg-gray-50',
                  selectedId === conv.id && 'bg-indigo-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar
                      src={conv.lead.avatarUrl}
                      fallback={conv.lead.fullName || conv.lead.username}
                      size="md"
                    />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-medium">
                        {conv.lead.fullName || conv.lead.username}
                      </p>
                      <span className="text-xs text-gray-400">
                        {conv.lastMessageAt && formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-500">
                      {conv.lastMessage?.content || 'Nenhuma mensagem'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation Detail */}
      <div className="flex flex-1 flex-col bg-gray-50">
        {selectedId && selectedConversation ? (
          <>
            {/* Header */}
            <div className="border-b bg-white p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={selectedConversation.lead.avatarUrl}
                  fallback={selectedConversation.lead.fullName || selectedConversation.lead.username}
                  size="md"
                />
                <div>
                  <p className="font-medium">
                    {selectedConversation.lead.fullName || selectedConversation.lead.username}
                  </p>
                  <p className="text-sm text-gray-500">
                    @{selectedConversation.lead.username} • {selectedConversation.platform}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {selectedConversation.messages?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.senderType === 'agent' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-4 py-2',
                        msg.senderType === 'agent'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white shadow'
                      )}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          msg.senderType === 'agent' ? 'text-indigo-200' : 'text-gray-400'
                        )}
                      >
                        {formatRelativeTime(msg.sentAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t bg-white p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={sendMutation.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Selecione uma conversa para começar
          </div>
        )}
      </div>
    </div>
  );
}
