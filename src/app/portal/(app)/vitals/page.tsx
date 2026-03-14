import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PortalVitalsForm } from "@/components/portal/portal-vitals-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import type { LastReading } from "@/components/portal/portal-vitals-fields";

export const metadata = { title: "Log Vitals" };

function formatVital(type: string, val: Record<string, unknown>): string {
  switch (type) {
    case "bp": return `${val.systolic}/${val.diastolic} mmHg`;
    case "weight": return `${val.value} ${val.unit ?? "lbs"}`;
    case "glucose": return `${val.value} mg/dL${val.context ? ` (${String(val.context).replace(/_/g, " ")})` : ""}`;
    case "heart_rate": return `${val.value} bpm`;
    case "temperature": return `${val.value}°${val.unit ?? "F"}`;
    case "fetal_movement": return `${val.count} kicks / ${val.period_hours}h`;
    case "oxygen_saturation": return `${val.value}%`;
    case "urine_protein": return String(val.result);
    default: return JSON.stringify(val);
  }
}

const TYPE_LABELS: Record<string, string> = {
  bp: "Blood Pressure", weight: "Weight", glucose: "Blood Glucose",
  heart_rate: "Heart Rate", temperature: "Temperature", fetal_movement: "Fetal Kicks",
  oxygen_saturation: "Oxygen Sat.", urine_protein: "Urine Protein",
};

export default async function PortalVitalsPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const recentVitals = await db.vital.findMany({
    where: { patientId: session.patientId },
    orderBy: { recordedAt: "desc" },
    take: 20,
  });

  // Most recent reading per type for smart validation (all fetched, compare in client)
  const lastReadings: Record<string, LastReading | null> = {};
  for (const v of recentVitals) {
    if (!lastReadings[v.type]) {
      lastReadings[v.type] = {
        value: v.value as Record<string, unknown>,
        recordedAt: v.recordedAt.toISOString(),
      };
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Log a Vital</h1>
        <p className="text-slate-500 text-sm mt-0.5">Share your readings with your care team</p>
      </div>

      <PortalVitalsForm patientId={session.patientId} lastReadings={lastReadings} />

      {recentVitals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700">Recent Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-50">
              {recentVitals.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-slate-500 w-32 shrink-0">{TYPE_LABELS[v.type] ?? v.type}</span>
                  <span className="font-medium text-slate-900 flex-1">{formatVital(v.type, v.value as Record<string, unknown>)}</span>
                  <span className="text-slate-400 text-xs shrink-0">{format(new Date(v.recordedAt), "MMM d, h:mm a")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
