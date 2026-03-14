"use server";

import { portalSignIn } from "@/lib/portal-auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  // Next.js 15: redirect() throws an Error with message "NEXT_REDIRECT"
  if (err instanceof Error && err.message === "NEXT_REDIRECT") return true;
  // Also check the digest property (format: "NEXT_REDIRECT;replace;/url;307;")
  if ("digest" in err && typeof (err as Record<string, unknown>).digest === "string") {
    return (err as { digest: string }).digest.startsWith("NEXT_REDIRECT");
  }
  return false;
}

export async function portalLoginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please enter a valid email and password." };
  }

  try {
    await portalSignIn("portal-credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/portal/dashboard",
    });
    // portalSignIn redirects on success; reaching here means auth failed
    return { error: "Incorrect email or password." };
  } catch (err) {
    // Always propagate redirect errors — Next.js needs them to navigate
    if (isNextRedirect(err)) throw err;
    return { error: "Incorrect email or password." };
  }
}
