'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOnboarding } from './useOnboarding';
import type { OnboardingPersona } from '@lia360/shared';

interface PersonaOption {
  value: OnboardingPersona;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    value: 'sales',
    title: 'Vendas',
    description: 'Foco em captura e qualificação de leads',
    icon: '💼',
    features: [
      'Captura de leads pelo Chrome Extension',
      'Gestão de pipeline de vendas',
      'Acompanhamento de negociações',
    ],
  },
  {
    value: 'marketing',
    title: 'Marketing',
    description: 'Foco em segmentação e automações',
    icon: '📊',
    features: [
      'Segmentação de audiências',
      'Automação de campanhas',
      'Análise de métricas de engajamento',
    ],
  },
  {
    value: 'management',
    title: 'Gestão',
    description: 'Visão geral e relatórios',
    icon: '📈',
    features: [
      'Dashboards de performance',
      'Relatórios de equipe',
      'Configuração de workspaces',
    ],
  },
];

interface OnboardingFlowProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: (persona: OnboardingPersona) => void;
}

export function OnboardingFlow({
  open: controlledOpen,
  onOpenChange,
  onComplete,
}: OnboardingFlowProps) {
  const { progress, updateProgress } = useOnboarding();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [selectedPersona, setSelectedPersona] = React.useState<OnboardingPersona | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Determine if dialog should be open
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Auto-open if persona is not set
  React.useEffect(() => {
    if (progress && !progress.persona) {
      setInternalOpen(true);
    }
  }, [progress]);

  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const handlePersonaSelect = async (persona: OnboardingPersona) => {
    setSelectedPersona(persona);
  };

  const handleConfirm = async () => {
    if (!selectedPersona) {
      toast.error('Selecione uma opção para continuar');
      return;
    }

    setLoading(true);

    try {
      await updateProgress({ persona: selectedPersona });

      toast.success('Perfil configurado com sucesso!', {
        description: 'Personalizaremos sua experiência com base no seu perfil.',
      });

      onComplete?.(selectedPersona);
      handleOpenChange(false);
    } catch (err) {
      toast.error('Erro ao configurar perfil', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    toast.info('Configuração de perfil pulada', {
      description: 'Você pode alterar isso nas configurações depois.',
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Bem-vindo à Lia 360! 🎉
          </DialogTitle>
          <DialogDescription className="text-base">
            Para personalizar sua experiência, selecione o perfil que melhor descreve sua função:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {PERSONA_OPTIONS.map((option) => (
            <Card
              key={option.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedPersona === option.value
                  ? 'ring-2 ring-indigo-500 bg-indigo-50'
                  : ''
              }`}
              onClick={() => handlePersonaSelect(option.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{option.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{option.title}</h3>
                      {selectedPersona === option.value && (
                        <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {option.description}
                    </p>
                    <ul className="space-y-1">
                      {option.features.map((feature, idx) => (
                        <li key={idx} className="text-xs text-gray-500 flex items-start gap-2">
                          <span className="text-indigo-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={loading}
          >
            Pular
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPersona || loading}
            className="min-w-[120px]"
          >
            {loading ? 'Configurando...' : 'Continuar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { OnboardingFlowProps };
