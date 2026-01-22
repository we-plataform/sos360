'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from '@/components/ui/avatar';
import {
  Linkedin,
  Mail,
  Phone,
  MessageCircle,
  Facebook,
  Twitter,
  Clock
} from 'lucide-react';
import type { KanbanLead } from './KanbanBoard';

interface KanbanCardProps {
  lead: KanbanLead;
  isDragging?: boolean;
  onClick?: () => void;
}

// Cores dos ícones de redes sociais
const SOCIAL_ICON_COLORS = {
  linkedin: '#0A66C2',
  email: '#8B5CF6',
  phone: '#10B981',
  whatsapp: '#25D366',
  facebook: '#1877F2',
  twitter: '#14171A',
  inactive: '#CBD5E1',
};

// Formata números grandes (ex: 2500 -> 2.5K)
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

// Obtém o texto de seguidores/conexões baseado na plataforma
function getFollowersText(lead: KanbanLead): string {
  const platform = lead.platform || lead.socialProfiles?.[0]?.platform;

  if (platform === 'linkedin') {
    const connections = lead.connectionCount;
    if (connections) {
      const connText = connections >= 500 ? '500+' : formatCount(connections);
      return `${connText} conexões`;
    }
  }

  const followers = lead.followersCount || lead.socialProfiles?.[0]?.followersCount;
  if (followers) {
    return `${formatCount(followers)} followers`;
  }

  return '';
}

// Verifica se há perfil de uma determinada plataforma
function hasSocialProfile(lead: KanbanLead, platform: string): boolean {
  return lead.socialProfiles?.some(p => p.platform === platform) || false;
}

export function KanbanCard({ lead, isDragging, onClick }: KanbanCardProps) {
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

  const followersText = getFollowersText(lead);

  // Verifica disponibilidade de cada canal de contato
  const hasLinkedin = hasSocialProfile(lead, 'linkedin');
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.phone;
  const hasWhatsapp = !!lead.phone; // Assumindo que se tem telefone, pode ter WhatsApp
  const hasFacebook = hasSocialProfile(lead, 'facebook');
  const hasTwitter = hasSocialProfile(lead, 'twitter');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''}`}
      onClick={onClick}
    >
      {/* Header: Avatar + Nome + Seguidores */}
      <div className="kanban-card__header">
        <Avatar
          src={lead.avatarUrl}
          fallback={lead.fullName || lead.username || '?'}
          size="md"
        />
        <div className="kanban-card__info">
          <span className="kanban-card__name">
            {lead.fullName || lead.username || 'Sem nome'}
          </span>
          {followersText && (
            <span className="kanban-card__followers">
              {followersText}
            </span>
          )}
        </div>
      </div>

      {/* Status Dropdown */}
      <div className="kanban-card__status-row">
        <select
          className="kanban-card__status-select"
          value={lead.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            // TODO: Implementar mudança de status
          }}
        >
          <option value="new">Lead In</option>
          <option value="contacted">Contatado</option>
          <option value="responded">Respondeu</option>
          <option value="qualified">Qualificado</option>
          <option value="scheduled">Agendado</option>
          <option value="closed">Fechado</option>
          <option value="lost">Perdido</option>
        </select>
      </div>

      {/* Social Icons Row */}
      <div className="kanban-card__social-icons">
        <button
          className="kanban-card__social-btn"
          title="LinkedIn"
          style={{ color: hasLinkedin ? SOCIAL_ICON_COLORS.linkedin : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <Linkedin size={16} />
        </button>
        <button
          className="kanban-card__social-btn"
          title="Email"
          style={{ color: hasEmail ? SOCIAL_ICON_COLORS.email : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail size={16} />
        </button>
        <button
          className="kanban-card__social-btn"
          title="Telefone"
          style={{ color: hasPhone ? SOCIAL_ICON_COLORS.phone : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone size={16} />
        </button>
        <button
          className="kanban-card__social-btn"
          title="WhatsApp"
          style={{ color: hasWhatsapp ? SOCIAL_ICON_COLORS.whatsapp : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle size={16} />
        </button>
        <button
          className="kanban-card__social-btn"
          title="Facebook"
          style={{ color: hasFacebook ? SOCIAL_ICON_COLORS.facebook : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <Facebook size={16} />
        </button>
        <button
          className="kanban-card__social-btn"
          title="X (Twitter)"
          style={{ color: hasTwitter ? SOCIAL_ICON_COLORS.twitter : SOCIAL_ICON_COLORS.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          <Twitter size={16} />
        </button>
      </div>

      {/* Footer: Badge + Valor + Priority */}
      <div className="kanban-card__footer">
        <div className="kanban-card__footer-left">
          <span className="kanban-card__badge kanban-card__badge--overdue">
            Overdue
          </span>
          <span className="kanban-card__value">$0</span>
        </div>
        <div className="kanban-card__footer-right">
          {lead.assignedTo && (
            <Avatar
              src={lead.assignedTo.avatarUrl}
              fallback={lead.assignedTo.fullName}
              size="xs"
            />
          )}
          <Clock size={16} className="kanban-card__priority-icon" />
        </div>
      </div>

      <style jsx>{`
                .kanban-card {
                    background: white;
                    border-radius: 12px;
                    padding: 0.875rem;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
                    cursor: grab;
                    transition: box-shadow 0.2s, transform 0.2s;
                    border: 2px solid #E0F2FE;
                }

                .kanban-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
                    border-color: #7DD3FC;
                }

                .kanban-card--dragging {
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    cursor: grabbing;
                }

                .kanban-card__header {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    margin-bottom: 0.625rem;
                }

                .kanban-card__info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                }

                .kanban-card__name {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #1e293b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .kanban-card__followers {
                    font-size: 0.75rem;
                    color: #64748b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .kanban-card__status-row {
                    margin-bottom: 0.625rem;
                }

                .kanban-card__status-select {
                    width: auto;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    background: white;
                    color: #475569;
                    cursor: pointer;
                }

                .kanban-card__status-select:hover {
                    border-color: #cbd5e1;
                }

                .kanban-card__social-icons {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    margin-bottom: 0.625rem;
                }

                .kanban-card__social-btn {
                    background: none;
                    border: none;
                    padding: 0.25rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background-color 0.15s;
                }

                .kanban-card__social-btn:hover {
                    background: #f1f5f9;
                }

                .kanban-card__footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .kanban-card__footer-left {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .kanban-card__footer-right {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .kanban-card__badge {
                    font-size: 0.625rem;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    text-transform: uppercase;
                }

                .kanban-card__badge--overdue {
                    background: linear-gradient(135deg, #ec4899, #f472b6);
                    color: white;
                }

                .kanban-card__value {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .kanban-card__priority-icon {
                    color: #1e293b;
                }
            `}</style>
    </div>
  );
}
