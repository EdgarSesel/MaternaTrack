import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin, getProviderScope } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { generatePatientSummaryPdf } from "@/lib/pdf-summary";
import { logAudit } from "@/lib/audit";
import { format } from "date-fns";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: patientId } = await params;
  const scope = getProviderScope(session as AuthSession);
  const providerFilter = scope ? { providerId: scope } : {};

  const patient = await db.patient.findFirst({
    where: { id: patientId, ...providerFilter, deletedAt: null },
    include: {
      vitals: { orderBy: { recordedAt: "desc" }, take: 20 },
      screenings: { orderBy: { administeredAt: "desc" }, take: 10 },
      carePlans: {
        where: { status: "active" },
        include: { tasks: { orderBy: { dueDate: "asc" } } },
      },
      timelineEvents: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!patient) {
    return new Response("Patient not found", { status: 404 });
  }

  try {
    const pdfBuffer = await generatePatientSummaryPdf(patient);
    const filename = `patient-summary-${format(new Date(), "yyyy-MM-dd")}.pdf`;

    logAudit({
      actorId: session.user.id,
      action: "export.patient_summary_pdf",
      resource: "Patient",
      resourceId: patientId,
      metadata: { format: "pdf" },
    });

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
