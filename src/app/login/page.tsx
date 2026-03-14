import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign In — MaternaTrack",
};

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">
              MaternaTrack
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Maternal Care Intelligence Dashboard
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
