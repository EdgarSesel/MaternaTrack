import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/generated/prisma/client";

const RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very High",
};

const RISK_CLASSES: Record<string, string> = {
  LOW: "bg-green-50 text-green-700 border-green-200 hover:bg-green-50",
  MODERATE: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50",
  VERY_HIGH: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
};

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  className?: string;
}

export function RiskBadge({ level, score, className }: RiskBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(RISK_CLASSES[level], "font-medium", className)}
    >
      {RISK_LABELS[level]}
      {score !== undefined && (
        <span className="ml-1 opacity-70">({score})</span>
      )}
    </Badge>
  );
}
