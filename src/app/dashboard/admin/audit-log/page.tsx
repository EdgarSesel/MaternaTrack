import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Shield, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuditLogFilters } from "@/components/admin/audit-log-filters";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Audit Log — MaternaTrack" };

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  "patient.view": "bg-blue-100 text-blue-800",
  "patient.create": "bg-blue-100 text-blue-800",
  "patient.update": "bg-blue-100 text-blue-800",
  "patient.delete": "bg-red-100 text-red-800",
  "patient.restore": "bg-green-100 text-green-800",
  "task.complete": "bg-green-100 text-green-800",
  "task.snooze": "bg-yellow-100 text-yellow-800",
  "task.mark_na": "bg-slate-100 text-slate-800",
  "message.send": "bg-violet-100 text-violet-800",
  "protocol.activate": "bg-emerald-100 text-emerald-800",
  "protocol.deactivate": "bg-orange-100 text-orange-800",
  "ai.save_summary": "bg-cyan-100 text-cyan-800",
  "appointment.create": "bg-indigo-100 text-indigo-800",
  "appointment.reschedule": "bg-indigo-100 text-indigo-800",
  "appointment.cancel_series": "bg-orange-100 text-orange-800",
  "vital.record": "bg-teal-100 text-teal-800",
  "screening.administered": "bg-purple-100 text-purple-800",
  "export.patient_summary_pdf": "bg-rose-100 text-rose-800",
  "staff.create": "bg-slate-100 text-slate-700",
  "staff.update": "bg-slate-100 text-slate-700",
};

interface SearchParams {
  page?: string;
  action?: string;
  resource?: string;
  actorType?: string;
  dateFrom?: string;
  dateTo?: string;
  range?: string;
}

function buildDateFilter(params: SearchParams) {
  const now = new Date();
  if (params.range) {
    const days = Number(params.range);
    return { gte: subDays(now, days) };
  }
  if (params.dateFrom || params.dateTo) {
    return {
      ...(params.dateFrom ? { gte: startOfDay(new Date(params.dateFrom)) } : {}),
      ...(params.dateTo ? { lte: endOfDay(new Date(params.dateTo)) } : {}),
    };
  }
  return undefined;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  requirePermission(session as AuthSession, PERMISSIONS.ADMIN_VIEW_AUDIT_LOG);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const dateFilter = buildDateFilter(params);

  const where = {
    ...(params.action ? { action: { contains: params.action, mode: "insensitive" as const } } : {}),
    ...(params.resource ? { resource: params.resource } : {}),
    ...(params.actorType ? { actorType: params.actorType } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const [logs, total, providers] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.provider.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build CSV export URL with current filters
  const csvParams = new URLSearchParams();
  if (params.action) csvParams.set("action", params.action);
  if (params.resource) csvParams.set("resource", params.resource);
  if (params.actorType) csvParams.set("actorType", params.actorType);
  if (params.dateFrom) csvParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) csvParams.set("dateTo", params.dateTo);
  if (params.range) csvParams.set("range", params.range);
  const csvUrl = `/api/export/audit-log?${csvParams.toString()}`;

  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            Audit Log
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            System-wide activity log · {total.toLocaleString()} total entries
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 shrink-0">
          <Link href={csvUrl}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <AuditLogFilters params={params} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-600">
            Showing {logs.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No entries match your filters</p>
              <p className="text-sm mt-1">Try broadening your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Timestamp</TableHead>
                    <TableHead className="w-45">Action</TableHead>
                    <TableHead className="w-27.5">Resource</TableHead>
                    <TableHead className="w-32.5">Actor</TableHead>
                    <TableHead className="w-20">Type</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const meta = log.metadata as Record<string, unknown>;
                    const actorName = providerMap[log.actorId];
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap font-mono">
                          {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{log.resource}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {actorName ?? (
                            <span className="font-mono text-slate-400">{log.actorId.slice(0, 10)}…</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            log.actorType === "patient"
                              ? "bg-rose-50 text-rose-700"
                              : log.actorType === "system"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            {log.actorType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 max-w-75 truncate">
                          {log.resourceId ? `${log.resourceId.slice(0, 12)}… ` : ""}
                          {meta && Object.keys(meta).length > 0
                            ? JSON.stringify(meta).slice(0, 80)
                            : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}>
                Previous
              </Link>
            </Button>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}>
                Next
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
