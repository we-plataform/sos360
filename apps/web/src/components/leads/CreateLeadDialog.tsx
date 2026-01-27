'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Platform } from '@lia360/shared';
import { DuplicateWarningDialog, type DuplicateLead } from './DuplicateWarningDialog';

const platforms: Platform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'whatsapp',
  'telegram',
  'discord',
  'reddit',
  'skool',
  'slack',
  'pinterest',
  'youtube',
  'nextdoor',
  'gohighlevel',
  'other',
];

const platformLabels: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
  reddit: 'Reddit',
  skool: 'Skool',
  slack: 'Slack',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  nextdoor: 'Nextdoor',
  gohighlevel: 'GoHighLevel',
  other: 'Outro',
};

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: PipelineStage[];
  onSuccess?: () => void;
}

const createLeadFormSchema = z
  .object({
    fullName: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
    email: z
      .string()
      .email('Email inválido')
      .optional()
      .or(z.literal('')),
    phone: z.string().max(50, 'Telefone muito longo').optional().or(z.literal('')),
    stageId: z.string().min(1, 'Selecione um estágio'),
    platform: z.enum(platforms as [Platform, ...Platform[]]).optional(),
    website: z
      .string()
      .url('URL inválida')
      .optional()
      .or(z.literal('')),
    location: z.string().max(200, 'Localização muito longa').optional(),
    notes: z.string().max(5000, 'Notas muito longas').optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Email ou telefone é obrigatório',
    path: ['email'],
  });

type CreateLeadForm = z.infer<typeof createLeadFormSchema>;

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  stageId?: string;
  platform?: string;
  website?: string;
  location?: string;
  notes?: string;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  onSuccess,
}: CreateLeadDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateLeadForm>({
    fullName: '',
    email: '',
    phone: '',
    stageId: stages[0]?.id || '',
    platform: undefined,
    website: '',
    location: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateLeads, setDuplicateLeads] = useState<DuplicateLead[]>([]);
  const [pendingFormData, setPendingFormData] = useState<CreateLeadForm | null>(null);

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      stageId: stages[0]?.id || '',
      platform: undefined,
      website: '',
      location: '',
      notes: '',
    });
    setErrors({});
  };

  const checkDuplicatesMutation = useMutation({
    mutationFn: async (data: CreateLeadForm) => {
      const params: { email?: string; phone?: string; platform?: string; profileUrl?: string } = {};
      if (data.email) params.email = data.email;
      if (data.phone) params.phone = data.phone;
      if (data.platform && formData.website) params.platform = data.platform;
      if (data.website) params.profileUrl = data.website;

      const response = await api.checkDuplicateLeads(params);
      return response;
    },
    onSuccess: (data, variables) => {
      if (data && data.duplicates && data.duplicates.length > 0) {
        setDuplicateLeads(data.duplicates);
        setPendingFormData(variables);
        setShowDuplicateWarning(true);
      } else {
        createLeadMutation.mutate(variables);
      }
    },
    onError: (error: Error) => {
      console.error('Error checking duplicates:', error);
      createLeadMutation.mutate(variables);
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: CreateLeadForm) => {
      const lead = await api.createLead({
        fullName: data.fullName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        platform: data.platform,
        website: data.website || undefined,
        location: data.location || undefined,
        notes: data.notes || undefined,
        pipelineStageId: data.stageId,
      });
      return lead;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['leads'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['pipeline', pipelineId], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['pipeline-leads'], type: 'active' });
      toast.success('Lead criado com sucesso!');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = createLeadFormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors;
        if (field) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    if (result.data.email || result.data.phone || result.data.website) {
      checkDuplicatesMutation.mutate(result.data);
    } else {
      createLeadMutation.mutate(result.data);
    }
  };

  const handleChange = (
    field: keyof CreateLeadForm,
    value: string | Platform | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDuplicateWarningProceed = () => {
    setShowDuplicateWarning(false);
    if (pendingFormData) {
      createLeadMutation.mutate(pendingFormData);
      setPendingFormData(null);
    }
  };

  const handleDuplicateWarningCancel = () => {
    setShowDuplicateWarning(false);
    setDuplicateLeads([]);
    setPendingFormData(null);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>
              Adicione um novo lead manualmente ao seu pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nome completo - obrigatório */}
            <div className="grid gap-2">
              <Label htmlFor="fullName">
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Ex: João Silva"
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Ex: joao@email.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Ex: (11) 99999-9999"
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Estágio do Pipeline - obrigatório */}
            <div className="grid gap-2">
              <Label htmlFor="stageId">
                Estágio <span className="text-red-500">*</span>
              </Label>
              <select
                id="stageId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.stageId}
                onChange={(e) => handleChange('stageId', e.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              {errors.stageId && (
                <p className="text-sm text-red-500">{errors.stageId}</p>
              )}
            </div>

            {/* Plataforma */}
            <div className="grid gap-2">
              <Label htmlFor="platform">Plataforma</Label>
              <select
                id="platform"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.platform || ''}
                onChange={(e) =>
                  handleChange(
                    'platform',
                    e.target.value ? (e.target.value as Platform) : undefined
                  )
                }
              >
                <option value="">Selecione uma plataforma</option>
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platformLabels[platform]}
                  </option>
                ))}
              </select>
              {errors.platform && (
                <p className="text-sm text-red-500">{errors.platform}</p>
              )}
            </div>

            {/* Website */}
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="Ex: https://exemplo.com"
              />
              {errors.website && (
                <p className="text-sm text-red-500">{errors.website}</p>
              )}
            </div>

            {/* Localização */}
            <div className="grid gap-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Ex: São Paulo, SP"
              />
              {errors.location && (
                <p className="text-sm text-red-500">{errors.location}</p>
              )}
            </div>

            {/* Notas */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Adicione observações sobre o lead..."
                rows={3}
              />
              {errors.notes && (
                <p className="text-sm text-red-500">{errors.notes}</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="text-red-500">*</span> Campos obrigatórios. Email
              ou telefone deve ser preenchido.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createLeadMutation.isPending || checkDuplicatesMutation.isPending}
            >
              {createLeadMutation.isPending || checkDuplicatesMutation.isPending
                ? 'Verificando...'
                : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DuplicateWarningDialog
      open={showDuplicateWarning}
      onOpenChange={setShowDuplicateWarning}
      duplicates={duplicateLeads}
      onProceed={handleDuplicateWarningProceed}
      onCancel={handleDuplicateWarningCancel}
    />
  </>
  );
}
