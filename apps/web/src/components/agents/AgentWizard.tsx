"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Check,
    ChevronRight,
    ChevronLeft,
    Bot,
    Sparkles,
    Settings2,
    BrainCircuit,
    MessageSquare,
    Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CreateAgentDTO } from "@/types/agent";
import { cn } from "@/lib/utils";

const STEPS = [
    { id: 1, name: "Identidade", icon: Bot, description: "Nome e propósito" },
    { id: 2, name: "Inteligência", icon: BrainCircuit, description: "Personalidade & IA" },
    { id: 3, name: "Ajustes Finos", icon: Settings2, description: "Parâmetros técnicos" },
];

const AGENT_TYPES = [
    {
        id: "SOCIAL_SELLER",
        label: "Social Seller",
        icon: MessageSquare,
        description: "Engaja em conversas, responde comentários e constrói relacionamentos."
    },
    {
        id: "SDR",
        label: "SDR (Pré-Vendas)",
        icon: Users,
        description: "Qualifica leads, faz triage inicial e agenda reuniões."
    },
    {
        id: "CLOSER",
        label: "Closer (Vendas)",
        icon: Sparkles,
        description: "Focado em conversão, negociação e fechamento de vendas."
    }
];

const MODELS = [
    {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        tag: "Rápido & Econômico",
        description: "Ideal para conversas rápidas e alto volume."
    },
    {
        id: "gpt-4o",
        name: "GPT-4o",
        tag: "Mais Inteligente",
        description: "Melhor para raciocínio complexo e negociação."
    },
];

export function AgentWizard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<Partial<CreateAgentDTO>>({
        name: "",
        description: "",
        type: "SOCIAL_SELLER",
        model: "gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 500,
        systemPrompt: "Você é um assistente útil e profissional.",
        enabled: true,
    });

    const createMutation = useMutation({
        mutationFn: (data: Partial<CreateAgentDTO>) => api.createAgent(data as Record<string, unknown>),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agents"] });
            toast.success("Agente criado com sucesso!");
            router.push("/dashboard/agents");
        },
        onError: (error: any) => {
            toast.error(error.message || "Erro ao criar agente");
        },
    });

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const updateField = (field: keyof CreateAgentDTO, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Premium Stepper */}
            <nav aria-label="Progress" className="mb-12">
                <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
                    {STEPS.map((step) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;

                        return (
                            <li key={step.name} className="md:flex-1">
                                <div
                                    className={cn(
                                        "group flex flex-col border-t-4 pt-4 transition-all duration-500",
                                        isActive ? "border-primary" : isCompleted ? "border-primary/60" : "border-muted"
                                    )}
                                >
                                    <span className={cn(
                                        "text-xs font-bold uppercase tracking-wider transition-colors mb-1",
                                        isActive ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        Passo 0{step.id}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <step.icon className={cn(
                                            "h-5 w-5 transition-colors",
                                            isActive ? "text-primary" : "text-muted-foreground"
                                        )} />
                                        <span className={cn(
                                            "text-sm font-semibold transition-colors",
                                            isActive ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {step.name}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                {/* Main Form Area */}
                <div className="lg:col-span-8 space-y-8">
                    <Card className="p-8 lg:p-10 shadow-lg border border-border/50 bg-card/50 backdrop-blur-sm rounded-3xl min-h-[500px]">
                        {currentStep === 1 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="space-y-2 border-b pb-6">
                                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Identidade & Propósito</h2>
                                    <p className="text-lg text-muted-foreground">Vamos definir quem é seu novo agente e qual papel ele desempenhará.</p>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold">Nome do Agente</Label>
                                        <Input
                                            placeholder="Ex: Ana - Consultora de Vendas"
                                            className="h-14 text-lg bg-background/50 border-input shadow-sm transition-all focus:ring-2 focus:ring-primary/20 rounded-xl"
                                            value={formData.name}
                                            onChange={(e) => updateField("name", e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold">Função Principal</Label>
                                        <div className="grid grid-cols-1 gap-4">
                                            {AGENT_TYPES.map((type) => (
                                                <div
                                                    key={type.id}
                                                    onClick={() => updateField("type", type.id)}
                                                    className={cn(
                                                        "cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-md flex items-start gap-5 group relative overflow-hidden",
                                                        formData.type === type.id
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                            : "border-border bg-card hover:border-primary/50"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "p-3 rounded-xl transition-colors",
                                                        formData.type === type.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                                    )}>
                                                        <type.icon className="h-6 w-6" />
                                                    </div>
                                                    <div className="space-y-1.5 relative z-10">
                                                        <p className={cn("font-bold text-lg", formData.type === type.id ? "text-primary" : "text-foreground")}>
                                                            {type.label}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">{type.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold">Descrição Interna (Opcional)</Label>
                                        <Textarea
                                            placeholder="Uma breve nota sobre o objetivo deste agente..."
                                            className="resize-none bg-background/50 border-input min-h-[100px] rounded-xl focus:ring-2 focus:ring-primary/20"
                                            value={formData.description}
                                            onChange={(e) => updateField("description", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="space-y-2 border-b pb-6">
                                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Definição da Persona</h2>
                                    <p className="text-lg text-muted-foreground">Instrua a IA sobre como ela deve se comportar, falar e reagir.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-base font-semibold">System Prompt (Instruções)</Label>
                                            <Button variant="outline" size="sm" className="text-xs gap-2 rounded-full border-primary/20 text-primary hover:bg-primary/5">
                                                <Sparkles className="h-3.5 w-3.5" /> Otimizar com IA
                                            </Button>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                                            <Textarea
                                                className="min-h-[400px] font-mono text-sm leading-7 p-6 bg-background rounded-xl border-border shadow-sm focus:ring-2 focus:ring-primary/20 resize-y"
                                                placeholder="# Contexto
Você é um especialista em vendas consultivas...

# Obejtivos
1. Qualificar o lead...
2. Agendar reunião...

# Tom de Voz
Profissional, empático e direto..."
                                                value={formData.systemPrompt}
                                                onChange={(e) => updateField("systemPrompt", e.target.value)}
                                            />
                                            <div className="absolute bottom-4 right-4 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-md border shadow-sm">
                                                {formData.systemPrompt?.length || 0} caracteres
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="space-y-2 border-b pb-6">
                                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuração Técnica</h2>
                                    <p className="text-lg text-muted-foreground">Ajuste os parâmetros do cérebro da IA para otimizar custos e performance.</p>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <Label className="text-base font-semibold">Selecione o Modelo</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {MODELS.map((model) => (
                                                <div
                                                    key={model.id}
                                                    onClick={() => updateField("model", model.id)}
                                                    className={cn(
                                                        "cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden group",
                                                        formData.model === model.id
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border bg-card opacity-80 hover:opacity-100 hover:border-primary/30"
                                                    )}
                                                >
                                                    {formData.model === model.id && (
                                                        <div className="absolute top-0 right-0 py-1 px-3 bg-primary text-primary-foreground rounded-bl-xl shadow-sm">
                                                            <Check className="h-4 w-4" />
                                                        </div>
                                                    )}
                                                    <div className="space-y-3">
                                                        <span className="inline-block px-2.5 py-1 rounded-md bg-background border text-[10px] uppercase font-bold tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                                                            {model.tag}
                                                        </span>
                                                        <p className="font-bold text-xl">{model.name}</p>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">{model.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-8 p-8 bg-muted/20 rounded-2xl border border-muted/50">
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-semibold">Temperatura (Criatividade)</Label>
                                                <span className="text-lg font-mono font-bold text-primary">{formData.temperature}</span>
                                            </div>
                                            <Slider
                                                defaultValue={[formData.temperature!]}
                                                max={2}
                                                step={0.1}
                                                className="py-4"
                                                onValueChange={(vals) => updateField("temperature", vals[0])}
                                            />
                                            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                                                <span>Preciso (0.1)</span>
                                                <span>Balanceado (0.7)</span>
                                                <span>Criativo (1.5+)</span>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-border/50 space-y-6">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-semibold">Limite de Tokens (Tamanho)</Label>
                                                <span className="text-lg font-mono font-bold text-primary">{formData.maxTokens}</span>
                                            </div>
                                            <Slider
                                                defaultValue={[formData.maxTokens!]}
                                                min={100}
                                                max={4000}
                                                step={100}
                                                className="py-4"
                                                onValueChange={(vals) => updateField("maxTokens", vals[0])}
                                            />
                                            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                                                <span>Curto (100)</span>
                                                <span>Médio (2000)</span>
                                                <span>Longo (4000)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className="flex justify-between pt-4 px-2">
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="text-muted-foreground hover:text-foreground pl-0 hover:bg-transparent"
                        >
                            <ChevronLeft className="mr-2 h-5 w-5" />
                            Voltar
                        </Button>
                        <Button size="lg" onClick={handleNext} disabled={createMutation.isPending} className="h-12 px-10 rounded-full text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5 bg-gradient-to-r from-primary to-violet-600 border-0">
                            {createMutation.isPending ? (
                                "Criando..."
                            ) : currentStep === STEPS.length ? (
                                <>
                                    Finalizar Criação
                                    <Check className="ml-2 h-5 w-5" />
                                </>
                            ) : (
                                <>
                                    Próximo Passo
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Live Preview Sidebar - Reflective Design Level */}
                <div className="hidden lg:block lg:col-span-4 space-y-6">
                    <div className="sticky top-8 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Live Preview</h3>
                        </div>

                        <Card className="p-0 border-0 shadow-2xl rounded-3xl overflow-hidden bg-background relative group">
                            {/* Card Header Background */}
                            <div className="h-32 bg-gradient-to-br from-primary via-primary/80 to-violet-600 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                            </div>

                            {/* Content */}
                            <div className="px-8 pb-8 pt-0 relative">
                                {/* Avatar */}
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                                    <div className="w-24 h-24 rounded-2xl bg-background p-1.5 shadow-xl rotate-3 transition-transform group-hover:rotate-0 duration-500">
                                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
                                            <Bot className="h-10 w-10 text-primary/80" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-16 text-center space-y-4">
                                    <div>
                                        <h3 className="text-2xl font-bold leading-tight break-words">{formData.name || "Nome do Agente"}</h3>
                                        <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                            {AGENT_TYPES.find(t => t.id === formData.type)?.label || "Função não definida"}
                                        </span>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-primary/5 to-transparent blur-sm"></div>
                                        <p className="relative text-sm text-muted-foreground leading-relaxed italic">
                                            "{formData.description || "A descrição e personalidade do seu agente aparecerão aqui à medida que você o configura..."}"
                                        </p>
                                    </div>

                                    <div className="pt-6 border-t w-full">
                                        <div className="grid grid-cols-2 gap-4 text-left">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold">Modelo</p>
                                                <div className="flex items-center gap-1.5 font-medium text-sm">
                                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                                    {MODELS.find(m => m.id === formData.model)?.name}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold">Criatividade</p>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(formData.temperature! / 2) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            <p className="flex gap-2">
                                <Bot className="h-4 w-4 shrink-0" />
                                Dica: Agentes com descrições detalhadas e prompts bem estruturados performam até 40% melhor.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
