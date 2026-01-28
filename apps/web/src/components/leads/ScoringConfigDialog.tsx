"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";
import type { CompanySize } from "@lia360/shared";

const companySizes: CompanySize[] = [
  "SIZE_1_10",
  "SIZE_11_50",
  "SIZE_51_200",
  "SIZE_201_500",
  "SIZE_501_1000",
  "SIZE_1001_5000",
  "SIZE_5001_10000",
  "SIZE_10001_PLUS",
];

const companySizeLabels: Record<CompanySize, string> = {
  SIZE_1_10: "1-10",
  SIZE_11_50: "11-50",
  SIZE_51_200: "51-200",
  SIZE_201_500: "201-500",
  SIZE_501_1000: "501-1,000",
  SIZE_1001_5000: "1,001-5,000",
  SIZE_5001_10000: "5,001-10,000",
  SIZE_10001_PLUS: "10,001+",
};

interface ScoringConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

const scoringConfigSchema = z
  .object({
    jobTitleWeight: z.number().int().min(0).max(100),
    companyWeight: z.number().int().min(0).max(100),
    profileCompletenessWeight: z.number().int().min(0).max(100),
    activityWeight: z.number().int().min(0).max(100),
    enrichmentWeight: z.number().int().min(0).max(100),
    targetJobTitles: z.array(z.string()),
    targetCompanySizes: z.array(z.string()),
    targetIndustries: z.array(z.string()),
    minProfileCompleteness: z.number().int().min(0).max(100),
    autoScoreOnImport: z.boolean(),
    autoScoreOnUpdate: z.boolean(),
  })
  .refine(
    (data) => {
      const total =
        data.jobTitleWeight +
        data.companyWeight +
        data.profileCompletenessWeight +
        data.activityWeight +
        data.enrichmentWeight;
      return total === 100;
    },
    {
      message: "Os pesos devem somar 100%",
      path: ["jobTitleWeight"],
    },
  );

type ScoringConfigForm = z.infer<typeof scoringConfigSchema>;

interface FormErrors {
  jobTitleWeight?: string;
  companyWeight?: string;
  profileCompletenessWeight?: string;
  activityWeight?: string;
  enrichmentWeight?: string;
  minProfileCompleteness?: string;
}

const defaultForm: ScoringConfigForm = {
  jobTitleWeight: 25,
  companyWeight: 20,
  profileCompletenessWeight: 15,
  activityWeight: 20,
  enrichmentWeight: 20,
  targetJobTitles: [],
  targetCompanySizes: [],
  targetIndustries: [],
  minProfileCompleteness: 50,
  autoScoreOnImport: true,
  autoScoreOnUpdate: true,
};

export function ScoringConfigDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: ScoringConfigDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ScoringConfigForm>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch existing config
  const { data: existingConfig } = useQuery({
    queryKey: ["scoring-config"],
    queryFn: () => api.getScoringConfig(),
    enabled: open,
    retry: false,
  });

  // Update form when config is loaded
  useEffect(() => {
    if (existingConfig) {
      const config = existingConfig as any;
      setFormData({
        jobTitleWeight: config.jobTitleWeight ?? 25,
        companyWeight: config.companyWeight ?? 20,
        profileCompletenessWeight: config.profileCompletenessWeight ?? 15,
        activityWeight: config.activityWeight ?? 20,
        enrichmentWeight: config.enrichmentWeight ?? 20,
        targetJobTitles: config.targetJobTitles ?? [],
        targetCompanySizes: config.targetCompanySizes ?? [],
        targetIndustries: config.targetIndustries ?? [],
        minProfileCompleteness: config.minProfileCompleteness ?? 50,
        autoScoreOnImport: config.autoScoreOnImport ?? true,
        autoScoreOnUpdate: config.autoScoreOnUpdate ?? true,
      });
    }
  }, [existingConfig]);

  const resetForm = () => {
    setFormData(defaultForm);
    setErrors({});
  };

  const saveConfigMutation = useMutation({
    mutationFn: async (data: ScoringConfigForm) => {
      if (existingConfig) {
        return await api.updateScoringConfig(data);
      } else {
        return await api.createScoringConfig(data);
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({
        queryKey: ["scoring-config"],
        type: "active",
      });
      toast.success("Configuração de pontuação salva com sucesso!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = scoringConfigSchema.safeParse(formData);

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
    saveConfigMutation.mutate(result.data);
  };

  const handleChange = (
    field: keyof ScoringConfigForm,
    value: string | number | boolean | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addTargetJobTitle = () => {
    const input = document.getElementById("new-job-title") as HTMLInputElement;
    const value = input?.value?.trim();
    if (value && !formData.targetJobTitles.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        targetJobTitles: [...prev.targetJobTitles, value],
      }));
      if (input) input.value = "";
    }
  };

  const removeTargetJobTitle = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      targetJobTitles: prev.targetJobTitles.filter((t) => t !== title),
    }));
  };

  const addTargetIndustry = () => {
    const input = document.getElementById("new-industry") as HTMLInputElement;
    const value = input?.value?.trim();
    if (value && !formData.targetIndustries.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        targetIndustries: [...prev.targetIndustries, value],
      }));
      if (input) input.value = "";
    }
  };

  const removeTargetIndustry = (industry: string) => {
    setFormData((prev) => ({
      ...prev,
      targetIndustries: prev.targetIndustries.filter((i) => i !== industry),
    }));
  };

  const toggleCompanySize = (size: CompanySize) => {
    setFormData((prev) => ({
      ...prev,
      targetCompanySizes: prev.targetCompanySizes.includes(size)
        ? prev.targetCompanySizes.filter((s) => s !== size)
        : [...prev.targetCompanySizes, size],
    }));
  };

  const totalWeight =
    formData.jobTitleWeight +
    formData.companyWeight +
    formData.profileCompletenessWeight +
    formData.activityWeight +
    formData.enrichmentWeight;

  const weightError = totalWeight !== 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração de Pontuação de Leads</DialogTitle>
          <DialogDescription>
            Personalize os critérios e pesos para calcular automaticamente a
            qualidade dos leads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Scoring Weights */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Pesos de Pontuação</h3>
              <p className="text-xs text-muted-foreground mb-4">
                A soma deve ser igual a 100%. Atual: {totalWeight}%
                {weightError && (
                  <span className="text-destructive ml-2">(Deve ser 100%)</span>
                )}
              </p>
            </div>

            {/* Job Title Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="jobTitleWeight" className="text-sm">
                  Título do Cargo
                </Label>
                <span className="text-sm font-medium">
                  {formData.jobTitleWeight}%
                </span>
              </div>
              <Input
                id="jobTitleWeight"
                type="range"
                min="0"
                max="100"
                value={formData.jobTitleWeight}
                onChange={(e) =>
                  handleChange("jobTitleWeight", parseInt(e.target.value))
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Correspondência com os títulos de cargo alvo
              </p>
            </div>

            {/* Company Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="companyWeight" className="text-sm">
                  Empresa
                </Label>
                <span className="text-sm font-medium">
                  {formData.companyWeight}%
                </span>
              </div>
              <Input
                id="companyWeight"
                type="range"
                min="0"
                max="100"
                value={formData.companyWeight}
                onChange={(e) =>
                  handleChange("companyWeight", parseInt(e.target.value))
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Tamanho e setor da empresa
              </p>
            </div>

            {/* Profile Completeness Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="profileCompletenessWeight" className="text-sm">
                  Completude do Perfil
                </Label>
                <span className="text-sm font-medium">
                  {formData.profileCompletenessWeight}%
                </span>
              </div>
              <Input
                id="profileCompletenessWeight"
                type="range"
                min="0"
                max="100"
                value={formData.profileCompletenessWeight}
                onChange={(e) =>
                  handleChange(
                    "profileCompletenessWeight",
                    parseInt(e.target.value),
                  )
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Quantidade e qualidade das informações disponíveis
              </p>
            </div>

            {/* Activity Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="activityWeight" className="text-sm">
                  Atividade
                </Label>
                <span className="text-sm font-medium">
                  {formData.activityWeight}%
                </span>
              </div>
              <Input
                id="activityWeight"
                type="range"
                min="0"
                max="100"
                value={formData.activityWeight}
                onChange={(e) =>
                  handleChange("activityWeight", parseInt(e.target.value))
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Sinais de engajamento e atividade recente
              </p>
            </div>

            {/* Enrichment Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="enrichmentWeight" className="text-sm">
                  Enriquecimento
                </Label>
                <span className="text-sm font-medium">
                  {formData.enrichmentWeight}%
                </span>
              </div>
              <Input
                id="enrichmentWeight"
                type="range"
                min="0"
                max="100"
                value={formData.enrichmentWeight}
                onChange={(e) =>
                  handleChange("enrichmentWeight", parseInt(e.target.value))
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Qualidade dos dados enriquecidos
              </p>
            </div>
          </div>

          {/* Target Criteria - ICP */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              Perfil Ideal de Cliente (ICP)
            </h3>

            {/* Target Job Titles */}
            <div className="space-y-2">
              <Label className="text-sm">Títulos de Cargo Alvo</Label>
              <div className="flex gap-2">
                <Input
                  id="new-job-title"
                  placeholder="Ex: CEO, CTO, VP of Engineering"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTargetJobTitle();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addTargetJobTitle}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.targetJobTitles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.targetJobTitles.map((title) => (
                    <div
                      key={title}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                    >
                      {title}
                      <button
                        type="button"
                        onClick={() => removeTargetJobTitle(title)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Target Company Sizes */}
            <div className="space-y-2">
              <Label className="text-sm">Tamanho da Empresa Alvo</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {companySizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleCompanySize(size)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.targetCompanySizes.includes(size)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-secondary"
                    }`}
                  >
                    {companySizeLabels[size]}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Industries */}
            <div className="space-y-2">
              <Label className="text-sm">Setores Alvo</Label>
              <div className="flex gap-2">
                <Input
                  id="new-industry"
                  placeholder="Ex: Tecnologia, Software, Saúde"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTargetIndustry();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addTargetIndustry}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.targetIndustries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.targetIndustries.map((industry) => (
                    <div
                      key={industry}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                    >
                      {industry}
                      <button
                        type="button"
                        onClick={() => removeTargetIndustry(industry)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Min Profile Completeness */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="minProfileCompleteness" className="text-sm">
                  Completude Mínima do Perfil
                </Label>
                <span className="text-sm font-medium">
                  {formData.minProfileCompleteness}%
                </span>
              </div>
              <Input
                id="minProfileCompleteness"
                type="range"
                min="0"
                max="100"
                value={formData.minProfileCompleteness}
                onChange={(e) =>
                  handleChange(
                    "minProfileCompleteness",
                    parseInt(e.target.value),
                  )
                }
                className="w-full cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Pontuação mínima para considerar o perfil completo
              </p>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Configurações Adicionais</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="autoScoreOnImport"
                  className="text-sm cursor-pointer"
                >
                  Pontuar ao Importar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Calcular automaticamente a pontuação ao importar leads
                </p>
              </div>
              <input
                id="autoScoreOnImport"
                type="checkbox"
                checked={formData.autoScoreOnImport}
                onChange={(e) =>
                  handleChange("autoScoreOnImport", e.target.checked)
                }
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="autoScoreOnUpdate"
                  className="text-sm cursor-pointer"
                >
                  Pontuar ao Atualizar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recalcular automaticamente ao atualizar dados do lead
                </p>
              </div>
              <input
                id="autoScoreOnUpdate"
                type="checkbox"
                checked={formData.autoScoreOnUpdate}
                onChange={(e) =>
                  handleChange("autoScoreOnUpdate", e.target.checked)
                }
                className="w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveConfigMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saveConfigMutation.isPending || weightError}
            >
              {saveConfigMutation.isPending
                ? "Salvando..."
                : "Salvar Configuração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
