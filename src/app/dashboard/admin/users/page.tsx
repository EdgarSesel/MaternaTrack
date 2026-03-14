import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { format } from "date-fns";
import { Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddStaffDialog } from "@/components/admin/add-staff-dialog";
import { EditStaffDialog } from "@/components/admin/edit-staff-dialog";

export const metadata = { title: "Staff Management" };

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-rose-100 text-rose-700",
  NURSE: "bg-blue-100 text-blue-700",
  MIDWIFE: "bg-purple-100 text-purple-700",
  OBGYN: "bg-green-100 text-green-700",
  DIETITIAN: "bg-amber-100 text-amber-700",
  THERAPIST: "bg-teal-100 text-teal-700",
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    requirePermission(session as AuthSession, PERMISSIONS.ADMIN_MANAGE_PROVIDERS);
  } catch {
    redirect("/dashboard");
  }

  const providers = await db.provider.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { patients: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{providers.length} team members</p>
        </div>
        <AddStaffDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            All Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-50">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 truncate">{p.email}</p>
                </div>
                <Badge className={`text-xs font-medium border-0 ${ROLE_COLORS[p.role] ?? "bg-slate-100 text-slate-600"}`}>
                  {p.role}
                </Badge>
                <div className="text-right text-xs text-slate-400 shrink-0 w-24">
                  <p>{p._count.patients} patients</p>
                  <p>{p.lastLoginAt ? format(new Date(p.lastLoginAt), "MMM d") : "Never logged in"}</p>
                </div>
                <EditStaffDialog provider={{ id: p.id, name: p.name, email: p.email, role: p.role }} />
              </div>
            ))}
            {providers.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-slate-400">No staff found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
