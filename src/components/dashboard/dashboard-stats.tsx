import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface Stats {
  total: number;
  highRisk: number;
  moderate: number;
  low: number;
  overdueTasks: number;
}

export function DashboardStats({ stats }: { stats: Stats }) {
  const items = [
    {
      label: "Total Patients",
      value: stats.total,
      icon: Users,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    {
      label: "High / Very High Risk",
      value: stats.highRisk,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Moderate Risk",
      value: stats.moderate,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Overdue Tasks",
      value: stats.overdueTasks,
      icon: CheckCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {item.value}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
