"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { KanbanPipeline, KanbanStage } from "./KanbanBoard";

interface PipelineColorDialogProps {
  pipeline: KanbanPipeline;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F43F5E",
  "#F59E0B",
  "#EAB308",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#0EA5E9",
  "#3B82F6",
  "#64748B",
];

export function PipelineColorDialog({
  pipeline,
  isOpen,
  onClose,
}: PipelineColorDialogProps) {
  const queryClient = useQueryClient();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const updateStageMutation = useMutation({
    mutationFn: ({ stageId, color }: { stageId: string; color: string }) =>
      api.updateStage(pipeline.id, stageId, { color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipeline.id] });
    },
  });

  const handleColorChange = (stageId: string, color: string) => {
    updateStageMutation.mutate({ stageId, color });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Personalizar Cores
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto bg-gray-50">
          <p className="text-sm text-gray-500 mb-4">
            Escolha as cores para identificar cada etapa do seu funil.
          </p>

          <div className="space-y-4">
            {pipeline.stages.map((stage) => (
              <div
                key={stage.id}
                className="bg-white p-4 rounded-lg border shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900">
                    {stage.name}
                  </span>
                  <div
                    className="w-6 h-6 rounded-full border border-gray-200"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>

                {/* Color Selector */}
                <div className="space-y-3">
                  {/* Preset Colors */}
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(stage.id, color)}
                        className={`w-6 h-6 rounded-full transition-all ${
                          stage.color === color
                            ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                            : "hover:scale-110 border border-transparent hover:border-gray-300"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  {/* Custom Color Picker */}
                  <div className="flex items-center gap-3 pt-2 border-t mt-2">
                    <span className="text-xs text-gray-500 uppercase font-semibold">
                      Cor Personalizada
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:ring-2 ring-indigo-200 transition-all">
                        <input
                          type="color"
                          value={stage.color}
                          onChange={(e) =>
                            handleColorChange(stage.id, e.target.value)
                          }
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        {stage.color}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t px-6 py-4 bg-gray-50 flex justify-end">
          <Button onClick={onClose}>Concluir</Button>
        </div>
      </div>
    </div>
  );
}
