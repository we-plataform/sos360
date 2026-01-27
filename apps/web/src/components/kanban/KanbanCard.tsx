'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from '@/components/ui/avatar';
import { KanbanLead } from './KanbanBoard';
import { ScoreBadge } from '@/components/leads/ScoreBadge';
import {
  Linkedin,
  Mail,
  Phone,
  MessageCircle,
  Facebook,
  Twitter,
  MoreVertical,
  Flag,
  Calendar,
  Users,
  Building2,
  ChevronDown
} from 'lucide-react';

interface KanbanCardProps {
  lead: KanbanLead;
  isDragging?: boolean;
  onClick?: () => void;
  onUpdateStatus?: (status: string) => void;
}

// Cores dos ícones de redes sociais (Vibrantes)
const SOCIAL_ICON_COLORS = {
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  email: '#EA4335',
  phone: '#34A853',
  whatsapp: '#25D366',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  inactive: '#94A3B8',
};

function formatCount(count: number | null | undefined): string {
  if (!count) return '0';
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

export function KanbanCard({ lead, isDragging, onClick, onUpdateStatus }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  // Logic for Gold Card (High Score / Priority)
  const isGold = (lead.score && lead.score > 70) || lead.verified; // Example criteria
  const cardBackground = isGold
    ? 'linear-gradient(135deg, #FDFBF0 0%, #F5E6AA 100%)'
    : 'white';

  const hasLinkedin = lead.platform === 'linkedin' || lead.socialProfiles?.some(p => p.platform === 'linkedin');
  const hasInstagram = lead.platform === 'instagram' || lead.socialProfiles?.some(p => p.platform === 'instagram');
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.phone;
  const hasWhatsapp = !!lead.phone; // Assumption

  // Stats text
  const followers = lead.followersCount ? formatCount(lead.followersCount) : null;
  const connections = lead.connectionCount ? formatCount(lead.connectionCount) : null;
  const connectionsText = connections ? (lead.connectionCount! >= 500 ? '500+ connections' : `${connections} connections`) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: cardBackground }}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''}`}
      onClick={onClick}
    >
      {/* Top Row: Avatar + Name + Score + Menu */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Avatar
            src={lead.avatarUrl}
            fallback={lead.fullName?.substring(0, 2).toUpperCase() || 'L'}
            className="w-8 h-8 rounded-full border border-gray-100 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-800 truncate" title={lead.fullName || ''}>
              {lead.fullName || lead.username || 'Lead sem nome'}
            </h4>
          </div>
          <ScoreBadge score={lead.score} size="sm" className="flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-300 hover:text-gray-500 cursor-pointer"><Flag size={12} fill="currentColor" /></span>
          <span className="text-gray-400 hover:text-gray-600 cursor-pointer"><MoreVertical size={14} /></span>
        </div>
      </div>

      {/* Stats / Info Row */}
      {(followers || connectionsText) && (
        <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 truncate">
          {followers && (
            <div className="flex items-center gap-1">
              <span className="font-semibold">{followers}</span> followers
            </div>
          )}
          {followers && connectionsText && <span>•</span>}
          {connectionsText && (
            <div className="flex items-center gap-1">
              {lead.connectionCount && lead.connectionCount < 500 && <Users size={10} />}
              {lead.connectionCount && lead.connectionCount >= 500 && <span className="font-bold text-[10px] bg-gray-100 text-gray-600 px-1 rounded">2nd</span>}
              {connectionsText}
            </div>
          )}
        </div>
      )}

      {/* Select Box - Lead Status */}
      <div className="mb-2">
        <div className="relative">
          <select
            className="appearance-none w-full bg-white border border-gray-200 text-gray-600 text-xs py-1 px-2 rounded focus:outline-none focus:border-blue-400 cursor-pointer"
            value={lead.status || 'new'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const newStatus = e.target.value;
              onUpdateStatus?.(newStatus);
            }}
          >
            <option value="new">Lead In</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <ChevronDown size={12} />
          </div>
        </div>
      </div>

      {/* Icons Row */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1 rounded cursor-pointer transition-colors ${hasLinkedin ? 'bg-blue-50' : ''}`}>
          <Linkedin size={14} color={hasLinkedin ? SOCIAL_ICON_COLORS.linkedin : SOCIAL_ICON_COLORS.inactive} fill={hasLinkedin ? 'currentColor' : 'none'} className={hasLinkedin ? 'text-[#0A66C2]' : ''} />
        </div>
        <div className={`p-1 rounded cursor-pointer transition-colors ${hasEmail ? 'bg-red-50' : ''}`}>
          <Mail size={14} color={hasEmail ? SOCIAL_ICON_COLORS.email : SOCIAL_ICON_COLORS.inactive} />
        </div>
        <div className={`p-1 rounded cursor-pointer transition-colors ${hasPhone ? 'bg-green-50' : ''}`}>
          <Phone size={14} color={hasPhone ? SOCIAL_ICON_COLORS.phone : SOCIAL_ICON_COLORS.inactive} />
        </div>
        <div className={`p-1 rounded cursor-pointer transition-colors ${hasWhatsapp ? 'bg-green-50' : ''}`}>
          <MessageCircle size={14} color={hasWhatsapp ? SOCIAL_ICON_COLORS.whatsapp : SOCIAL_ICON_COLORS.inactive} />
        </div>
        {/* Placeholder for X/Other */}
        <div className="p-1 rounded cursor-pointer">
          <span className="text-gray-300 font-bold text-xs">✕</span>
        </div>
      </div>

      {/* Footer: Date/Money */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="bg-[#EC008C] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
            Overdue
          </div>
          <span className="text-xs text-gray-400 font-medium">$0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-300 hover:text-gray-500 cursor-pointer"><Building2 size={12} /></span>
          <div className="w-4 h-4 rounded-full bg-gray-800 text-white flex items-center justify-center text-[8px] cursor-pointer hover:bg-black">
            <ChevronDown size={10} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .kanban-card {
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
            border: 1px solid rgba(0,0,0,0.05);
            cursor: grab;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        
        .kanban-card:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .kanban-card--dragging {
             box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
             cursor: grabbing;
             opacity: 0.9;
             transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}
