'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Mail, Phone, Link } from 'lucide-react';

export interface MatchReason {
  email?: boolean;
  phone?: boolean;
  profileUrl?: boolean;
}

export interface DuplicateLead {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  platform?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  matchReasons: MatchReason;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateLead[];
  onProceed: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onProceed,
  onCancel,
}: DuplicateWarningDialogProps) {
  if (duplicates.length === 0) {
    return null;
  }

  const getMatchLabels = (reasons: MatchReason): string[] => {
    const labels: string[] = [];
    if (reasons.email) labels.push('email');
    if (reasons.phone) labels.push('telefone');
    if (reasons.profileUrl) labels.push('perfil');
    return labels;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Possíveis Leads Duplicados
          </DialogTitle>
          <DialogDescription>
            Encontramos {duplicates.length} lead(s) existente(s) que pode(m) ser duplicata(s).
            Verifique os detalhes abaixo antes de prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {duplicates.map((duplicate) => (
            <Card key={duplicate.id} className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {duplicate.avatarUrl ? (
                    <img
                      src={duplicate.avatarUrl}
                      alt={duplicate.fullName || 'Avatar'}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <span className="text-sm font-medium">
                        {(duplicate.fullName || '?').substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="font-semibold">{duplicate.fullName || 'Sem nome'}</h4>
                      {duplicate.platform && duplicate.username && (
                        <p className="text-sm text-muted-foreground">
                          @{duplicate.username} ({duplicate.platform})
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      {duplicate.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{duplicate.email}</span>
                        </div>
                      )}
                      {duplicate.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{duplicate.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <Link className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Coincide por:{' '}
                        <span className="font-medium text-foreground">
                          {getMatchLabels(duplicate.matchReasons).join(', ')}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onProceed}>
            Prosseguir com Criação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
