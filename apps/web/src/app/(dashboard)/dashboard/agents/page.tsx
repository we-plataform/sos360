"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Search,
    LayoutGrid,
    List as ListIcon,
    MoreVertical,
    Pencil,
    Trash2,
    Bot,
    Sparkles,
    Zap,
    ArrowUpDown,
    Filter
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { Agent } from "@/types/agent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: agents, isLoading } = useQuery({
        queryKey: ["agents"],
        queryFn: () => api.getAgents() as Promise<Agent[]>,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteAgent(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agents"] });
            toast.success("Agente removido com sucesso");
        },
        onError: () => {
            toast.error("Erro ao remover agente");
        },
    });

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja remover este agente?")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredAgents = agents?.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 p-6 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Hero Header - Visceral Design Level */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border/40">
                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Seus Agentes
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl text-balance">
                        Escale sua operação com inteligência artificial. Gerencie assistentes que trabalham 24/7 para você.
                    </p>
                </div>
                <Link href="/dashboard/agents/new">
                    <Button size="lg" className="h-12 px-8 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-violet-600 border-0">
                        <Plus className="mr-2 h-5 w-5" />
                        Criar Novo Agente
                    </Button>
                </Link>
            </div>

            {/* Controls Bar - Behavioral Design Level */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-4 z-10 bg-background/80 backdrop-blur-md p-4 rounded-2xl border shadow-sm transition-all duration-300">
                <div className="relative w-full sm:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Buscar por nome ou descrição..."
                        className="pl-10 h-10 bg-muted/40 border-transparent focus:bg-background focus:border-primary transition-all duration-300 rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "h-8 px-3 rounded-md transition-all duration-200",
                                viewMode === "grid" ? "bg-background shadow-sm text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Grade
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className={cn(
                                "h-8 px-3 rounded-md transition-all duration-200",
                                viewMode === "list" ? "bg-background shadow-sm text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ListIcon className="h-4 w-4 mr-2" />
                            Lista
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="h-[280px] rounded-2xl border-muted bg-muted/10 animate-pulse" />
                    ))}
                </div>
            ) : filteredAgents && filteredAgents.length > 0 ? (
                viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAgents.map((agent) => (
                            <Card key={agent.id} className="group relative overflow-hidden rounded-2xl border-muted/60 bg-background hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href={`/dashboard/agents/${agent.id}/edit`}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Editar Configurações
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(agent.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Agente
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="p-6 space-y-6 flex-1">
                                    <div className="flex items-start justify-between">
                                        <div className="relative">
                                            <Avatar className="h-16 w-16 border-4 border-background shadow-lg group-hover:scale-105 transition-transform duration-300">
                                                <AvatarImage src={agent.avatarUrl} className="object-cover" />
                                                <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/30 text-primary font-bold text-xl">
                                                    {agent.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className={cn(
                                                "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background",
                                                agent.enabled ? "bg-green-500" : "bg-muted-foreground"
                                            )} />
                                        </div>
                                        <Badge variant="outline" className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/5 border-primary/20 text-primary uppercase tracking-wider">
                                            {agent.type.replace('_', ' ')}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="font-bold text-xl leading-tight group-hover:text-primary transition-colors cursor-pointer">
                                            <Link href={`/dashboard/agents/${agent.id}/edit`}>{agent.name}</Link>
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                            {agent.description || "Sem descrição definida. Adicione detalhes para identificar melhor este agente."}
                                        </p>
                                    </div>
                                </div>

                                <div className="px-6 py-4 bg-muted/20 border-t border-muted/50 flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-1.5" title="Modelo de IA">
                                        <Zap className={cn("h-3.5 w-3.5", agent.model.includes('gpt-4') ? "text-amber-500" : "text-blue-500")} />
                                        {agent.model}
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Data de criação">
                                        <Bot className="h-3.5 w-3.5" />
                                        Criado {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true, locale: ptBR })}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="rounded-2xl border-muted/60 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/30 text-muted-foreground font-semibold uppercase text-xs tracking-wider border-b">
                                    <tr>
                                        <th className="px-6 py-4">Agente</th>
                                        <th className="px-6 py-4">Função</th>
                                        <th className="px-6 py-4">Modelo</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Última atualização</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredAgents.map((agent) => (
                                        <tr key={agent.id} className="hover:bg-muted/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-10 w-10 border border-border shadow-sm">
                                                        <AvatarImage src={agent.avatarUrl} />
                                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                                            {agent.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                            <Link href={`/dashboard/agents/${agent.id}/edit`}>{agent.name}</Link>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {agent.description || "Sem descrição"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="font-medium">
                                                    {agent.type}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Zap className="h-3.5 w-3.5 opacity-70" />
                                                    {agent.model}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                                                    agent.enabled
                                                        ? "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-900"
                                                        : "bg-muted text-muted-foreground border-muted-foreground/20"
                                                )}>
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", agent.enabled ? "bg-green-500" : "bg-muted-foreground")} />
                                                    {agent.enabled ? "Ativo" : "Pausado"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true, locale: ptBR })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link href={`/dashboard/agents/${agent.id}/edit`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                                                        onClick={() => handleDelete(agent.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[500px] border-2 border-dashed rounded-3xl border-muted-foreground/20 bg-muted/5 p-8 text-center animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
                    {/* Background decorative elements */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />

                    <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-background border-4 border-background shadow-xl flex items-center justify-center mb-8 relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-full animate-pulse" />
                            <Bot className="h-10 w-10 text-primary relative z-10" />
                        </div>

                        <h3 className="text-2xl font-bold bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent mb-3">
                            Nenhum agente encontrado
                        </h3>

                        <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                            Sua força de trabalho digital começa aqui. Crie agentes especializados para automatizar vendas, suporte e prospecção.
                        </p>

                        <Link href="/dashboard/agents/new">
                            <Button size="lg" className="h-14 px-10 rounded-full text-lg shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 bg-gradient-to-r from-primary to-violet-600">
                                <Plus className="mr-2 h-5 w-5" />
                                Criar Primeiro Agente
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
