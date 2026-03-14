"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalSignOutAction } from "@/app/portal/actions/portal-auth-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Overview", href: "/portal/dashboard" },
  { label: "Appointments", href: "/portal/appointments" },
  { label: "Messages", href: "/portal/messages" },
  { label: "Care Plan", href: "/portal/care-plan" },
  { label: "Vitals", href: "/portal/vitals" },
];

interface PortalNavProps {
  patientName: string;
}

export function PortalNav({ patientName }: PortalNavProps) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-rose-100 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 bg-rose-600 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-medium text-slate-900 text-sm hidden sm:block">{patientName}</span>
          </div>

          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-rose-50 text-rose-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={portalSignOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="text-slate-500 text-xs">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
