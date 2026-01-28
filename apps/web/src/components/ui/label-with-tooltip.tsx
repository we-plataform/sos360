import React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LabelWithTooltipProps {
  children: React.ReactNode;
  tooltip: string;
  className?: string;
}

export function LabelWithTooltip({
  children,
  tooltip,
  className = "",
}: LabelWithTooltipProps) {
  return (
    <div className={`flex items-center gap-2 mb-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {children}
      </label>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-gray-400 hover:text-indigo-600 cursor-help transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-sm">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
