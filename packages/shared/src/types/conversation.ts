import { Platform } from './lead';

export type ConversationStatus = 'active' | 'archived';
export type SenderType = 'agent' | 'lead' | 'system';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: string;
  platform: Platform;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    platform: Platform;
    profileUrl?: string;
  };
  assignedTo?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  lastMessage?: Message;
}

export interface Message {
  id: string;
  content: string;
  senderType: SenderType;
  senderId?: string;
  messageType: MessageType;
  status: MessageStatus;
  metadata?: Record<string, unknown>;
  readAt?: string;
  sentAt: string;
}

export interface SendMessageRequest {
  content: string;
  messageType?: MessageType;
}

export interface ConversationFilters {
  status?: ConversationStatus;
  unread?: boolean;
  platform?: Platform;
  assignedTo?: string;
}
