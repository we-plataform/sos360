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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages?: PipelineStage[];
  tags?: Tag[];
}

export function ExportLeadsDialog({ open, onOpenChange, stages = [], tags = [] }: ExportLeadsDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(DEFAULT_FIELDS)
  );
  const [isExporting, setIsExporting] = useState(false);

  // Filter states
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [createdAfter, setCreatedAfter] = useState<string>('');
  const [createdBefore, setCreatedBefore] = useState<string>('');

  const resetForm = () => {
    setSelectedFields(new Set(DEFAULT_FIELDS));
    setSelectedStageId('');
    setSelectedTagIds(new Set());
    setCreatedAfter('');
    setCreatedBefore('');
    setIsExporting(false);
  };

  const handleClose = () => {
    if (!isExporting) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
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
        stageId: selectedStageId || undefined,
        tagIds: selectedTagIds.size > 0 ? Array.from(selectedTagIds) : undefined,
        createdAfter: createdAfter || undefined,
        createdBefore: createdBefore || undefined,
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
          {/* Filters Section */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">Filtros</h4>
            </div>

            {/* Stage Filter */}
            {stages.length > 0 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stage-filter" className="text-sm">
                  Estágio
                </Label>
                <Select
                  value={selectedStageId}
                  onValueChange={setSelectedStageId}
                  disabled={isExporting}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Todos os estágios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os estágios</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags Filter */}
            {tags.length > 0 && (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-sm mt-2">Tags</Label>
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`tag-${tag.id}`}
                        checked={selectedTagIds.has(tag.id)}
                        onChange={() => handleToggleTag(tag.id)}
                        disabled={isExporting}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Label
                        htmlFor={`tag-${tag.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range Filter */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="created-after" className="text-sm">
                  Criado após
                </Label>
                <Input
                  id="created-after"
                  type="date"
                  value={createdAfter}
                  onChange={(e) => setCreatedAfter(e.target.value)}
                  disabled={isExporting}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="created-before" className="text-sm">
                  Criado antes
                </Label>
                <Input
                  id="created-before"
                  type="date"
                  value={createdBefore}
                  onChange={(e) => setCreatedBefore(e.target.value)}
                  disabled={isExporting}
                  className="col-span-3"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
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
