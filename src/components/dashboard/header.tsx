import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    NURSE: "Nurse",
    MIDWIFE: "Midwife",
    OBGYN: "OB-GYN",
    DIETITIAN: "Dietitian",
    THERAPIST: "Therapist",
    ADMIN: "Admin",
  };
  return map[role] ?? role;
}

export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-14 xl:left-56 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
      <div />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto py-1.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-rose-100 text-rose-700">
                  {getInitials(user.name ?? "")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="text-sm font-medium leading-none">{user.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{getRoleBadge(user.role)}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="flex items-center gap-2 w-full text-sm">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </header>
  );
}
