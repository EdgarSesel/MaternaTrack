"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  error?: string;
}

function errorMessage(code?: string): string | null {
  if (!code) return null;
  if (code === "CredentialsSignin") return "Incorrect email or password.";
  return "An error occurred. Please try again.";
}

export function PortalLoginForm({ error }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayError = submitError ?? errorMessage(error);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      // Fetch the CSRF token issued by the portal auth instance
      const csrfRes = await fetch("/portal/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("csrf_fetch_failed");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      // Programmatic form POST — let the browser follow the redirect natively
      // so auth.js can set the session cookie and navigate to the dashboard.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/portal/api/auth/callback/credentials";

      for (const [name, value] of Object.entries({ email, password, csrfToken, callbackUrl: "/portal/dashboard" })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      // Browser navigates away; no need to setLoading(false)
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium">Sign in to your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {displayError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {displayError}
            </p>
          )}

          <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Are you a care provider?{" "}
          <Link href="/login" className="text-rose-600 hover:underline">
            Provider sign-in →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
