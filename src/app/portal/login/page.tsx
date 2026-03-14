import { PortalLoginForm } from "@/components/portal/portal-login-form";

export const metadata = { title: "Patient Portal — Sign In" };

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function PortalLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-600 rounded-2xl mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Patient Portal</h1>
          <p className="text-slate-500 text-sm mt-1">
            Sign in to view your care plan and message your care team
          </p>
        </div>
        <PortalLoginForm error={error} />
        <p className="text-center text-xs text-slate-400">
          Need access? Contact your care team to set up your account.
        </p>
      </div>
    </div>
  );
}
