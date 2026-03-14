"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  BarChart3,
  Heart,
  Shield,
  CalendarDays,
  Users,
  Menu,
  ShieldCheck,
  Activity,
  Filter,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays, exact: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck, exact: false },
  { href: "/dashboard/cohorts", label: "Cohorts", icon: Filter, exact: false },
  { href: "/dashboard/admin/users", label: "Staff", icon: Users, exact: false, adminOnly: true },
  { href: "/dashboard/admin/performance", label: "Performance", icon: Activity, exact: false, adminOnly: true },
  { href: "/dashboard/admin/audit-log", label: "Audit Log", icon: Shield, exact: false, adminOnly: true },
];

interface SidebarProps {
  userRole: string;
}

function NavLinks({
  userRole,
  collapsed,
  onNavigate,
}: {
  userRole: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItems.filter((item) => !item.adminOnly || userRole === "ADMIN");

  return (
    <nav className="flex-1 px-2 py-4 space-y-0.5">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              collapsed ? "justify-center px-2" : "",
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ userRole }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger trigger — visible below lg (1024px) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-20 p-2 rounded-md bg-slate-900 text-slate-100"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile sidebar — Sheet below 1024px */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0 bg-slate-900 border-slate-700">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-700">
            <div className="w-7 h-7 bg-rose-500 rounded-md flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none text-slate-100">MaternaTrack</div>
              <div className="text-xs text-slate-400 mt-0.5">Care Intelligence</div>
            </div>
          </div>
          <NavLinks
            userRole={userRole}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="px-3 py-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">v0.1 — Pomelo Care Demo</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Icon-only sidebar — visible 1024px–1280px */}
      <aside className="hidden lg:flex xl:hidden fixed left-0 top-0 bottom-0 w-14 bg-slate-900 text-slate-100 flex-col z-10">
        <div className="flex items-center justify-center py-5 border-b border-slate-700">
          <div className="w-7 h-7 bg-rose-500 rounded-md flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
        </div>
        <NavLinks userRole={userRole} collapsed={true} />
      </aside>

      {/* Full sidebar — visible 1280px+ */}
      <aside className="hidden xl:flex fixed left-0 top-0 bottom-0 w-56 bg-slate-900 text-slate-100 flex-col z-10">
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-700">
          <div className="w-7 h-7 bg-rose-500 rounded-md flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">MaternaTrack</div>
            <div className="text-xs text-slate-400 mt-0.5">Care Intelligence</div>
          </div>
        </div>
        <NavLinks userRole={userRole} collapsed={false} />
        <div className="px-3 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">v0.1 — Pomelo Care Demo</p>
        </div>
      </aside>
    </>
  );
}
