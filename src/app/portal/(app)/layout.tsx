import type { Metadata } from "next";
import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/portal-nav";

export const metadata: Metadata = {
  title: { default: "Patient Portal", template: "%s — Patient Portal" },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div className="min-h-screen bg-rose-50">
      <PortalNav patientName={session.name} />
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
