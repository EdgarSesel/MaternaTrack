import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { SessionTimeout } from "@/components/dashboard/session-timeout";
import { KeyboardHelp } from "@/components/dashboard/keyboard-help";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar userRole={session.user.role} />
      <Header />
      {/* Responsive left margin: 0 on mobile, icon-sidebar (56px) on lg, full sidebar (224px) on xl */}
      <main className="pt-14 min-h-screen ml-0 lg:ml-14 xl:ml-56">
        <div className="p-6">{children}</div>
      </main>
      <SessionTimeout />
      <KeyboardHelp />
    </div>
  );
}
