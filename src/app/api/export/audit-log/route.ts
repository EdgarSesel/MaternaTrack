import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { toCsv, csvResponse } from "@/lib/export";
import { format } from "date-fns";

export const runtime = "nodejs";

function buildDateFilter(params: URLSearchParams) {
  const range = params.get("range");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (range) {
    return { gte: subDays(new Date(), Number(range)) };
  }
  if (dateFrom || dateTo) {
    return {
      ...(dateFrom ? { gte: startOfDay(new Date(dateFrom)) } : {}),
      ...(dateTo ? { lte: endOfDay(new Date(dateTo)) } : {}),
    };
  }
  return undefined;
}

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  requirePermission(session as AuthSession, PERMISSIONS.ADMIN_VIEW_AUDIT_LOG);

  const url = new URL(req.url);
  const params = url.searchParams;
  const dateFilter = buildDateFilter(params);

  const where = {
    ...(params.get("action") ? { action: { contains: params.get("action")!, mode: "insensitive" as const } } : {}),
    ...(params.get("resource") ? { resource: params.get("resource")! } : {}),
    ...(params.get("actorType") ? { actorType: params.get("actorType")! } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const [logs, providers] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    db.provider.findMany({ select: { id: true, name: true } }),
  ]);

  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  const rows = logs.map((log) => ({
    timestamp: format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId ?? "",
    actorId: log.actorId,
    actorName: providerMap[log.actorId] ?? "",
    actorType: log.actorType,
    metadata: JSON.stringify(log.metadata),
    ipAddress: log.ipAddress ?? "",
  }));

  const csv = toCsv(rows);
  const filename = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
  return csvResponse(csv, filename);
}
