"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Baby, Apple, AlertTriangle, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import type { EducationalContent } from "@/lib/educational-content";

interface Props {
  content: EducationalContent;
}

function Section({
  title,
  icon: Icon,
  items,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 2);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <h4 className={`text-xs font-semibold ${accent}`}>{title}</h4>
      </div>
      <ul className="space-y-1">
        {shown.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
            <span className="mt-1 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Show less</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Show {items.length - 2} more</>
          )}
        </button>
      )}
    </div>
  );
}

export function PortalEducationalContent({ content }: Props) {
  return (
    <Card className="border-rose-100 bg-gradient-to-b from-rose-50/30 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-rose-500 font-medium uppercase tracking-wide mb-0.5">
              Week {content.week}
            </p>
            <CardTitle className="text-base font-semibold text-slate-800">
              {content.milestone}
            </CardTitle>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">Baby size</p>
            <p className="text-sm font-medium text-slate-700">{content.babySize}</p>
          </div>
        </div>
        {content.upcomingAppointment && (
          <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-2 mt-2">
            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">{content.upcomingAppointment}</p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Section
          title="What to Expect"
          icon={Baby}
          items={content.whatToExpect}
          accent="text-slate-500"
        />
        <div className="border-t border-slate-100" />
        <Section
          title="Nutrition Tips"
          icon={Apple}
          items={content.nutritionTips}
          accent="text-green-600"
        />
        <div className="border-t border-slate-100" />
        <Section
          title="Warning Signs — Contact Your Provider"
          icon={AlertTriangle}
          items={content.warningSigns}
          accent="text-red-500"
        />
      </CardContent>
    </Card>
  );
}
