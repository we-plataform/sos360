import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { Play } from "lucide-react";
import { KanbanStage } from "./KanbanBoard";

interface AutomationAction {
  type: "connection_request" | "send_message" | "move_pipeline_stage";
  config?: Record<string, unknown>;
}

interface RunAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (config: { maxLeads: number; interval: string }) => void;
  stage: KanbanStage;
  automationName: string;
  actions?: AutomationAction[];
}

const ACTION_LABELS: Record<string, string> = {
  connection_request: "Linkedin: Connection Request",
  send_message: "Linkedin: Enviar Mensagem",
  move_pipeline_stage: "Mover para Coluna",
};

const ACTION_COLORS: Record<string, string> = {
  connection_request: "bg-blue-500",
  send_message: "bg-purple-500",
  move_pipeline_stage: "bg-orange-500",
};

export function RunAutomationModal({
  isOpen,
  onClose,
  onRun,
  stage,
  automationName,
  actions = [],
}: RunAutomationModalProps) {
  const [maxLeads, setMaxLeads] = React.useState<number>(
    Math.min(stage.leads.length, 40),
  );
  const [interval, setInterval] = React.useState<string>("60-90");

  // Validate max leads limits (1-40)
  const handleMaxLeadsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    if (val > 40) val = 40;
    if (val < 1) val = 1;
    setMaxLeads(val);
  };

  const handleRun = () => {
    onRun({ maxLeads, interval });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Run Automation: {automationName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4 p-4 bg-secondary/20 rounded-lg border border-secondary">
            <div className="bg-primary/10 p-3 rounded-md text-center min-w-[100px]">
              <div className="text-2xl font-bold text-primary">
                {stage.leads.length}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Stage Leads
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Configurando execução para o estágio <strong>{stage.name}</strong>
              . Por segurança, recomendamos limitar o número de contatos por
              execução.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxLeads">Máximo de Leads</Label>
              <Input
                id="maxLeads"
                type="number"
                min={1}
                max={40}
                value={maxLeads}
                onChange={handleMaxLeadsChange}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Limite recomendado: 40 por dia
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">Intervalo entre Ações</Label>
              <select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="30-60">30 a 60 segundos (Rápido)</option>
                <option value="60-90">60 a 90 segundos (Padrão)</option>
                <option value="90-120">90 a 120 segundos (Seguro)</option>
                <option value="120-180">2 a 3 minutos (Muito Seguro)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Intervalo aleatório para simular comportamento humano
              </p>
            </div>
          </div>

          {/* Configuration Summary - Mimicking the user screenshot visually */}
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Ações Definidas:
            </h4>

            <div className="space-y-2">
              {actions.length === 0 ? (
                <div className="border rounded-md p-3 text-sm text-muted-foreground bg-muted/30">
                  Nenhuma ação configurada
                </div>
              ) : (
                actions.map((action, index) => (
                  <div
                    key={index}
                    className="border rounded-md p-3 flex items-center justify-between bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1 h-4 ${ACTION_COLORS[action.type] || "bg-gray-500"} rounded-full mr-2`}
                      ></div>
                      <span className="text-sm font-medium">
                        {index + 1}. {ACTION_LABELS[action.type] || action.type}
                      </span>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
            <Info className="w-3 h-3" />
            <span>Configurações aplicadas apenas para esta execução.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            className="bg-pink-600 hover:bg-pink-700 text-white gap-2 min-w-[200px]"
          >
            <Play className="w-4 h-4" />
            Run Automation for {maxLeads} Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper icon import (make sure to import Info from lucide-react at top if not there)
import { Info } from "lucide-react";
