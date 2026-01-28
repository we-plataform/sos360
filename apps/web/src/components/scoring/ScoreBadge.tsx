import React from "react";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ScoreBadge({
  score,
  size = "md",
  showLabel = false,
  className,
  onClick,
}: ScoreBadgeProps) {
  // Determine color based on score
  const getColor = () => {
    if (score >= 80) return "bg-green-500 text-white";
    if (score >= 50) return "bg-yellow-500 text-white";
    return "bg-red-500 text-white";
  };

  // Determine size classes
  const getSize = () => {
    switch (size) {
      case "sm":
        return "h-6 px-2 text-xs font-semibold";
      case "lg":
        return "h-10 px-3 text-sm font-bold";
      default:
        return "h-8 px-2.5 text-xs font-bold";
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold transition-colors",
        getColor(),
        getSize(),
        onClick && "cursor-pointer hover:opacity-90",
        className,
      )}
      onClick={onClick}
    >
      <span>{score}</span>
      {showLabel && (
        <span className="hidden sm:inline">
          {score >= 80 ? "Hot" : score >= 50 ? "Warm" : "Cold"}
        </span>
      )}
    </div>
  );
}
