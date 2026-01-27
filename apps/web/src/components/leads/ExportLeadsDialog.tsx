'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Available lead fields for export - from context.json
const LEAD_FIELDS = [
  { id: 'id', label: 'ID', category: 'Basic' },
  { id: 'fullName', label: 'Nome Completo', category: 'Basic' },
  { id: 'username', label: 'Nome de Usuário', category: 'Basic' },
  { id: 'email', label: 'Email', category: 'Basic' },
  { id: 'phone', label: 'Telefone', category: 'Basic' },
  { id: 'website', label: 'Website', category: 'Basic' },
  { id: 'location', label: 'Localização', category: 'Basic' },
  { id: 'bio', label: 'Bio', category: 'Basic' },
  { id: 'platform', label: 'Plataforma', category: 'Basic' },
  { id: 'profileUrl', label: 'URL do Perfil', category: 'Basic' },
  { id: 'avatarUrl', label: 'URL do Avatar', category: 'Basic' },
  { id: 'status', label: 'Status', category: 'Basic' },
  { id: 'score', label: 'Score', category: 'Basic' },
  { id: 'notes', label: 'Notas', category: 'Basic' },
  { id: 'createdAt', label: 'Data de Criação', category: 'Basic' },
  { id: 'updatedAt', label: 'Data de Atualização', category: 'Basic' },
  { id: 'headline', label: 'Headline (LinkedIn)', category: 'LinkedIn' },
  { id: 'company', label: 'Empresa', category: 'LinkedIn' },
  { id: 'industry', label: 'Indústria', category: 'LinkedIn' },
  { id: 'connectionCount', label: 'Conexões (LinkedIn)', category: 'LinkedIn' },
  { id: 'followersCount', label: 'Seguidores', category: 'Social' },
  { id: 'followingCount', label: 'Seguindo', category: 'Social' },
  { id: 'postsCount', label: 'Posts', category: 'Social' },
  { id: 'verified', label: 'Verificado', category: 'Social' },
  { id: 'gender', label: 'Gênero', category: 'Enrichment' },
  { id: 'priority', label: 'Prioridade', category: 'Enrichment' },
  { id: 'jobTitle', label: 'Título do Trabalho', category: 'Enrichment' },
  { id: 'companySize', label: 'Tamanho da Empresa', category: 'Enrichment' },
  { id: 'assignedTo', label: 'Responsável', category: 'Pipeline' },
  { id: 'pipelineStage', label: 'Estágio do Pipeline', category: 'Pipeline' },
  { id: 'tags', label: 'Tags', category: 'Pipeline' },
  { id: 'address.city', label: 'Cidade', category: 'Address' },
  { id: 'address.state', label: 'Estado', category: 'Address' },
  { id: 'address.country', label: 'País', category: 'Address' },
];

// Default fields to export (basic contact info)
const DEFAULT_FIELDS = [
  'fullName',
  'email',
  'phone',
  'company',
  'jobTitle',
  'pipelineStage',
  'tags',
];

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportLeadsDialog({ open, onOpenChange }: ExportLeadsDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(DEFAULT_FIELDS)
  );
  const [isExporting, setIsExporting] = useState(false);

  const resetForm = () => {
    setSelectedFields(new Set(DEFAULT_FIELDS));
    setIsExporting(false);
  };

  const handleClose = () => {
    if (!isExporting) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleToggleField = (fieldId: string) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedFields.size === LEAD_FIELDS.length) {
      // If all are selected, deselect all
      setSelectedFields(new Set());
    } else {
      // Otherwise, select all
      setSelectedFields(new Set(LEAD_FIELDS.map((f) => f.id)));
    }
  };

  const handleSelectDefaults = () => {
    setSelectedFields(new Set(DEFAULT_FIELDS));
  };

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      toast.error('Selecione pelo menos um campo para exportar');
      return;
    }

    setIsExporting(true);

    try {
      const blob = await api.exportLeads({
        fields: Array.from(selectedFields),
      });

      // Ensure blob has correct MIME type for CSV with UTF-8 encoding
      // This is important for Excel to recognize the UTF-8 BOM correctly
      const csvBlob = new Blob([blob], { type: 'text/csv; charset=utf-8' });

      // Create download link
      const url = window.URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;

      // Format filename: leads-YYYY-MM-DD.csv
      const date = new Date().toISOString().split('T')[0];
      a.download = `leads-${date}.csv`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Leads exportados com sucesso!');
      resetForm();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao exportar leads';
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  // Group fields by category
  const groupedFields = LEAD_FIELDS.reduce<Record<string, typeof LEAD_FIELDS>>(
    (acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    },
    {}
  );

  const allSelected = selectedFields.size === LEAD_FIELDS.length;
  const someSelected = selectedFields.size > 0 && selectedFields.size < LEAD_FIELDS.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Leads</DialogTitle>
          <DialogDescription>
            Selecione os campos que deseja incluir no arquivo CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleAll}
              disabled={isExporting}
            >
              {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectDefaults}
              disabled={isExporting}
            >
              Seleção Padrão
            </Button>
            <span className="ml-auto text-sm text-muted-foreground flex items-center">
              {selectedFields.size} campo{selectedFields.size !== 1 ? 's' : ''} selecionado
              {selectedFields.size !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Field Selection */}
          <div className="space-y-4">
            {Object.entries(groupedFields).map(([category, fields]) => (
              <div key={category}>
                <h4 className="font-medium text-sm mb-2 text-foreground">{category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={field.id}
                        checked={selectedFields.has(field.id)}
                        onChange={() => handleToggleField(field.id)}
                        disabled={isExporting}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Label
                        htmlFor={field.id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Warning message */}
          {selectedFields.size === 0 && (
            <p className="text-sm text-red-500">
              Selecione pelo menos um campo para continuar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || selectedFields.size === 0}
          >
            {isExporting ? 'Exportando...' : 'Baixar CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
