'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, PlusCircle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useAuthStore } from '@/stores/auth';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContextSelector({ collapsed = false }: { collapsed?: boolean }) {
    const currentCompany = useAuthStore((state) => state.currentCompany);
    const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
    const availableCompanies = useAuthStore((state) => state.availableCompanies);
    const switchWorkspace = useAuthStore((state) => state.switchWorkspace);
    const switchCompany = useAuthStore((state) => state.switchCompany);
    const createWorkspace = useAuthStore((state) => state.createWorkspace);

    const [open, setOpen] = React.useState(false);
    const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = React.useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;

        setIsCreating(true);
        try {
            await createWorkspace(newWorkspaceName);
            setShowNewWorkspaceDialog(false);
            setNewWorkspaceName("");
        } catch (error) {
            console.error('Failed to create workspace:', error);
        } finally {
            setIsCreating(false);
        }
    };

    if (!currentCompany || !currentWorkspace) return null;

    return (
        <>
            <Dialog open={showNewWorkspaceDialog} onOpenChange={setShowNewWorkspaceDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar Novo Workspace</DialogTitle>
                        <DialogDescription>
                            Adicione um novo workspace para separar seus projetos e leads.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateWorkspace}>
                        <div className="flex flex-col gap-4 py-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="name" className="text-left font-medium">
                                    Nome
                                </Label>
                                <Input
                                    id="name"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                    placeholder="Ex: Marketing"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowNewWorkspaceDialog(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isCreating || !newWorkspaceName.trim()}>
                                {isCreating ? "Criando..." : "Criar Workspace"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full p-2 h-auto hover:bg-gray-100",
                            collapsed ? "justify-center" : "justify-between"
                        )}
                    >
                        {collapsed ? (
                            <div className="flex items-center justify-center p-1 rounded-sm bg-primary/10 text-primary font-bold shrink-0">
                                {currentWorkspace.name.substring(0, 2).toUpperCase()}
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{currentCompany.name}</span>
                                    <span className="font-semibold truncate w-full text-left">{currentWorkspace.name}</span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[240px]" align="start">
                    <DropdownMenuLabel>Alternar Workspace</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <div className="max-h-[300px] overflow-y-auto">
                        {availableCompanies.map((company) => (
                            <DropdownMenuGroup key={company.id}>
                                {company.workspaces.map((workspace) => (
                                    <DropdownMenuItem
                                        key={workspace.id}
                                        onSelect={() => {
                                            if (company.id === currentCompany.id) {
                                                if (workspace.id !== currentWorkspace.id) {
                                                    switchWorkspace(workspace.id);
                                                }
                                            } else {
                                                switchCompany(company.id, workspace.id);
                                            }
                                            setOpen(false);
                                        }}
                                        className="flex items-center justify-between cursor-pointer"
                                    >
                                        <span>{workspace.name}</span>
                                        {workspace.id === currentWorkspace.id && company.id === currentCompany.id && (
                                            <Check className="h-4 w-4" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuGroup>
                        ))}
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => {
                            setOpen(false);
                            setShowNewWorkspaceDialog(true);
                        }}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Novo Workspace
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
