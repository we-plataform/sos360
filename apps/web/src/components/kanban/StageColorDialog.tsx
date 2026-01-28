"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { KanbanStage } from "./KanbanBoard";

interface StageColorDialogProps {
  pipelineId: string;
  stage: KanbanStage;
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

export function StageColorDialog({
  pipelineId,
  stage,
  isOpen,
  onClose,
}: StageColorDialogProps) {
  const queryClient = useQueryClient();
  const [currentColor, setCurrentColor] = useState(stage.color);

  useEffect(() => {
    setCurrentColor(stage.color);
  }, [stage.color]);

  const updateStageMutation = useMutation({
    mutationFn: (color: string) =>
      api.updateStage(pipelineId, stage.id, { color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      // Don't close immediately to allow user to see change, but maybe optional
    },
  });

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    updateStageMutation.mutate(color);
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
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Cor do Estágio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border shadow-sm">
            <span className="font-medium text-gray-900">{stage.name}</span>
            <div
              className="w-8 h-8 rounded-full border border-gray-200 shadow-sm"
              style={{ backgroundColor: currentColor }}
            />
          </div>

          <div className="space-y-4">
            {/* Preset Colors */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                Cores Sugeridas
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      currentColor === color
                        ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                        : "hover:scale-110 border border-transparent hover:border-gray-300"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Custom Color Picker */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                Personalizado
              </label>
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg border">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:ring-2 ring-indigo-200 transition-all">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">
                    Seletor
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {currentColor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 bg-gray-50 flex justify-end">
          <Button onClick={onClose} size="sm">
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
