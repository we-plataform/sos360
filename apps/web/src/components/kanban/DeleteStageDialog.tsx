'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface DeleteStageDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    stageName: string;
    isPending: boolean;
}

export function DeleteStageDialog({
    isOpen,
    onClose,
    onConfirm,
    stageName,
    isPending
}: DeleteStageDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <AlertTriangle className="h-6 w-6" />
                        <DialogTitle>Excluir Estágio</DialogTitle>
                    </div>
                    <DialogDescription>
                        Tem certeza que deseja excluir o estágio <span className="font-semibold text-gray-900">"{stageName}"</span>?
                        <br /><br />
                        Essa ação não pode ser desfeita. Certifique-se de mover os leads para outro estágio antes de excluir.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isPending ? 'Excluindo...' : 'Sim, Excluir'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
