"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFields = z.infer<typeof loginSchema>;
type FieldErrors = Partial<Record<keyof LoginFields, string>>;

export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const formData = new FormData(e.currentTarget);
    const raw = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const result = loginSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginFields;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email: result.data.email,
        password: result.data.password,
        redirect: false,
      });

      if (res?.error) {
        setServerError("Invalid email or password.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to your account</CardTitle>
        <CardDescription>
          Enter your credentials to access the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nurse@materna.dev"
              disabled={isLoading}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isLoading}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password && (
              <p id="password-error" className="text-xs text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Demo accounts</p>
          <div className="space-y-0.5 text-xs text-slate-500 font-mono">
            <div>nurse@materna.dev / password123</div>
            <div>midwife@materna.dev / password123</div>
            <div>admin@materna.dev / password123</div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          Are you a patient?{" "}
          <Link href="/portal/login" className="text-blue-600 hover:underline">
            Patient portal →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
